import { createCanvas } from "@napi-rs/canvas";
import { prisma } from "./prisma";
import { getSupabaseAdmin, MODULE_ASSETS_BUCKET } from "./supabaseAdmin";

// pdfjs-dist's legacy build is the one meant to run outside a browser (no
// DOM, no Worker) — the standard (non-legacy) build assumes a browser
// environment and will not load in a Next.js API route.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const RENDER_SCALE = 2; // ~144 DPI reference render — enough for on-screen editor fidelity without huge files

export type PageAnalysisResult = {
  pageNumber: number;
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID";
  referenceImageUrl: string;
};

// A page counts as having a text layer if it has any non-whitespace text
// items. Pages with zero text items are pure scans; pages with both text
// items AND embedded raster images larger than a small icon are treated as
// hybrid (spec §5 — Type C).
async function classifyPageType(
  page: any
): Promise<"DIGITAL" | "SCANNED" | "HYBRID"> {
  const textContent = await page.getTextContent();
  const hasText = textContent.items.some(
    (item: any) => typeof item.str === "string" && item.str.trim().length > 0
  );

  const opList = await page.getOperatorList();
  const hasLargeImage = opList.fnArray.includes(pdfjsLib.OPS.paintImageXObject);

  if (hasText && hasLargeImage) return "HYBRID";
  if (hasText) return "DIGITAL";
  return "SCANNED"; // no extractable text at all — must be a scan
}

async function renderPageToPng(page: any): Promise<Buffer> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as any,
    viewport,
  }).promise;

  return canvas.toBuffer("image/png");
}

// Runs the full Phase 3 pipeline for one module: classify + render every
// page, upload reference images, update ModulePage rows, and roll the
// per-page results up into Module.pdfType. Reports progress via the given
// callback so the caller can persist it onto a ProcessingJob row.
export async function analyzeModulePdf(
  moduleId: string,
  originalPdfBuffer: Buffer,
  onProgress?: (progress: number, stage: string) => Promise<void>
): Promise<PageAnalysisResult[]> {
  const supabase = getSupabaseAdmin();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(originalPdfBuffer),
    // Fonts/CMaps aren't bundled for the server build — standard fonts
    // load fine without them for text detection; missing glyphs on
    // unusual embedded fonts would only affect the reference render's
    // visual accuracy, not the digital/scanned classification.
    disableFontFace: true,
  });
  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  const results: PageAnalysisResult[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);

    const pdfType = await classifyPageType(page);
    const pngBuffer = await renderPageToPng(page);

    const storagePath = `${moduleId}/page-${String(i).padStart(4, "0")}.png`;
    const { error: uploadError } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      throw new Error(`Failed to upload reference image for page ${i}: ${uploadError.message}`);
    }

    const { data: signedUrlData } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days — refreshed on next view via a signed-URL endpoint, not stored as permanent

    results.push({
      pageNumber: i,
      pdfType,
      referenceImageUrl: signedUrlData?.signedUrl || storagePath,
    });

    await prisma.modulePage.update({
      where: { moduleId_pageNumber: { moduleId, pageNumber: i } },
      data: {
        pdfType,
        referenceImageUrl: storagePath, // store the storage path, not the signed URL — signed URLs expire
        needsReview: true, // still true — text/image *content* extraction (Phase 4) hasn't run
        warnings: [{ type: "NOT_EXTRACTED", message: "Reference image rendered; content extraction not yet run" }],
      },
    });

    if (onProgress) {
      await onProgress(Math.round((i / pageCount) * 100), `Rendering page ${i} of ${pageCount}`);
    }
  }

  const types = new Set(results.map((r) => r.pdfType));
  const moduleType = types.size > 1 ? "HYBRID" : (results[0]?.pdfType ?? "UNKNOWN");

  await prisma.module.update({
    where: { id: moduleId },
    data: { pdfType: moduleType as any, status: "REVIEW_REQUIRED" },
  });

  return results;
}

// Phase 4: walks the already-rendered pages and populates ModulePage.elements.
// Requires analyzeModulePdf() to have run first (reference images + per-page
// pdfType must already exist).
export async function extractModuleContent(
  moduleId: string,
  originalPdfBuffer: Buffer,
  onProgress?: (progress: number, stage: string) => Promise<void>
): Promise<void> {
  const { extractPageElements } = await import("./moduleExtraction");
  const supabase = getSupabaseAdmin();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(originalPdfBuffer),
    disableFontFace: true,
  });
  const pdfDoc = await loadingTask.promise;

  const pages = await prisma.modulePage.findMany({
    where: { moduleId },
    orderBy: { pageNumber: "asc" },
  });

  let anyWarnings = false;

  for (const page of pages) {
    if (!page.referenceImageUrl) {
      throw new Error(`Page ${page.pageNumber} has no reference image — run analysis before extraction.`);
    }

    const { data: refFile, error: downloadError } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .download(page.referenceImageUrl);
    if (downloadError || !refFile) {
      throw new Error(`Could not download reference image for page ${page.pageNumber}: ${downloadError?.message}`);
    }
    const refBuffer = Buffer.from(await refFile.arrayBuffer());

    const { elements, warnings } = await extractPageElements(
      pdfDoc,
      moduleId,
      page.pageNumber,
      page.width,
      page.height,
      page.pdfType as "DIGITAL" | "SCANNED" | "HYBRID",
      refBuffer
    );

    if (warnings.length > 0) anyWarnings = true;

    await prisma.modulePage.update({
      where: { id: page.id },
      data: {
        elements: elements as any,
        warnings: warnings as any,
        needsReview: warnings.length > 0,
      },
    });

    if (onProgress) {
      await onProgress(Math.round((page.pageNumber / pages.length) * 100), `Extracting page ${page.pageNumber} of ${pages.length}`);
    }
  }

  await prisma.module.update({
    where: { id: moduleId },
    data: { status: anyWarnings ? "REVIEW_REQUIRED" : "READY" },
  });
}
