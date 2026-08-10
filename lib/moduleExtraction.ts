import { createCanvas, loadImage } from "@napi-rs/canvas";
async function getPdfjsLib() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}
import { getSupabaseAdmin, MODULE_ASSETS_BUCKET } from "./supabaseAdmin";

// eslint-disable-next-line @typescript-eslint/no-var-requires


const RENDER_SCALE = 2; // must match lib/modulePdfAnalysis.ts — reference images were rendered at this scale

export type ModuleElementJson = {
  id: string;
  type:
    | "TEXT"
    | "HEADING"
    | "PARAGRAPH"
    | "QUESTION"
    | "OPTION"
    | "SOLUTION"
    | "IMAGE"
    | "HEADER"
    | "FOOTER"
    | "WATERMARK";
  x: number; // PDF points, top-left origin — matches ModulePage.width/height
  y: number;
  width: number;
  height: number;
  content?: string;
  fontSize?: number;
  assetId?: string;
  rotation?: number; // degrees; currently only set by the branding system (watermark) — not editable via drag in the canvas
  opacity?: number; // 0-1
  locked?: boolean; // true for branding-applied elements — editor should warn before allowing free-drag edits, not yet enforced in the canvas
  confidence: "HIGH" | "HEURISTIC"; // HEURISTIC = classified by pattern/font-size guess, not certain — surfaced to the reviewer, never hidden
};

type RawTextItem = {
  str: string;
  x: number;
  yTop: number; // top-left y, already flipped from PDF's bottom-up space
  width: number;
  fontSize: number;
};

// ---- Text: group raw items into lines, lines into blocks, blocks into typed elements ----

function classifyBlockText(text: string): ModuleElementJson["type"] {
  const t = text.trim();
  if (/^(Q\.?\s*\d+|Question\s*\d+)/i.test(t)) return "QUESTION";
  if (/^\(?[A-D]\)?[.)]\s/.test(t)) return "OPTION";
  if (/^(Sol(ution)?|Ans(wer)?)[:.]/i.test(t)) return "SOLUTION";
  return "PARAGRAPH"; // font-size-based HEADING override happens in the caller, which has page-wide context
}

async function extractTextElements(
  page: any,
  pageHeight: number
): Promise<ModuleElementJson[]> {
  const textContent = await page.getTextContent();

  const items: RawTextItem[] = textContent.items
    .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
    .map((it: any) => {
      const fontSize = Math.hypot(it.transform[2], it.transform[3]) || 10;
      return {
        str: it.str,
        x: it.transform[4],
        yTop: pageHeight - it.transform[5] - fontSize,
        width: it.width,
        fontSize,
      };
    });

  if (items.length === 0) return [];

  // Group into lines: items whose baseline is within half a font-size of each other.
  items.sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  const lines: RawTextItem[][] = [];
  for (const item of items) {
    const last = lines[lines.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && Math.abs(item.yTop - prev.yTop) < prev.fontSize * 0.5) {
      last.push(item);
    } else {
      lines.push([item]);
    }
  }

  // Group lines into blocks: a gap taller than ~1x the line's font size starts a new block —
  // this is a heuristic, not real paragraph-structure detection, and is labeled as such below.
  const medianFontSize = items.map((i) => i.fontSize).sort((a, b) => a - b)[Math.floor(items.length / 2)];
  const headingThreshold = medianFontSize * 1.25;

  const blocks: RawTextItem[][][] = [];
  for (const line of lines) {
    const lastBlock = blocks[blocks.length - 1];
    const lastLineOfBlock = lastBlock?.[lastBlock.length - 1];
    const lineFontSize = line[0].fontSize;
    const gap = lastLineOfBlock ? line[0].yTop - (lastLineOfBlock[0].yTop + lastLineOfBlock[0].fontSize) : Infinity;
    if (lastBlock && gap < lineFontSize * 0.8) {
      lastBlock.push(line);
    } else {
      blocks.push([line]);
    }
  }

  return blocks.map((block, i) => {
    const text = block.map((line) => line.map((it) => it.str).join(" ")).join(" ");
    const xs = block.flatMap((l) => l.map((it) => it.x));
    const xEnds = block.flatMap((l) => l.map((it) => it.x + it.width));
    const ys = block.flatMap((l) => l.map((it) => it.yTop));
    const yEnds = block.flatMap((l) => l.map((it) => it.yTop + it.fontSize));
    const avgFontSize = block.flatMap((l) => l.map((it) => it.fontSize)).reduce((a, b) => a + b, 0) / block.flat().length;

    const patternType = classifyBlockText(text);
    const type = patternType === "PARAGRAPH" && avgFontSize >= headingThreshold ? "HEADING" : patternType;

    return {
      id: `el_${String(i).padStart(4, "0")}_text`,
      type,
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xEnds) - Math.min(...xs),
      height: Math.max(...yEnds) - Math.min(...ys),
      content: text,
      fontSize: Math.round(avgFontSize * 10) / 10,
      confidence: "HEURISTIC", // line/block grouping and type are both guesses — always surfaced for review, per spec §29
    };
  });
}

// ---- Images: track the CTM through the operator list, crop matching region from the reference PNG ----

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

type ImageRegion = { x: number; y: number; width: number; height: number };

// Images are painted onto the unit square [0,1]x[0,1] transformed by the
// current transformation matrix — standard PDF convention. Walking
// save/restore/transform ops to track that matrix is the only reliable way
// to get an image's real placement; pdfjs doesn't expose per-image bounds
// directly from getOperatorList().
async function findImageRegions(
  page: any,
  pageHeight: number,
  pdfjsLib: any
): Promise<ImageRegion[]> {
  const opList = await page.getOperatorList();
  const regions: ImageRegion[] = [];
  const stack: Matrix[] = [IDENTITY];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      stack.push([...stack[stack.length - 1]] as Matrix);
    } else if (fn === pdfjsLib.OPS.restore) {
      if (stack.length > 1) stack.pop();
    } else if (fn === pdfjsLib.OPS.transform) {
      const current = stack[stack.length - 1];
      stack[stack.length - 1] = multiply(current, args as Matrix);
    } else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageMaskXObject) {
      const m = stack[stack.length - 1];
      const corners = [applyMatrix(m, 0, 0), applyMatrix(m, 1, 0), applyMatrix(m, 0, 1), applyMatrix(m, 1, 1)];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      // Skip near-zero-area regions — usually 1x1 shading fills, not real images.
      if (xMax - xMin > 5 && yMax - yMin > 5) {
        regions.push({
          x: xMin,
          y: pageHeight - yMax,
          width: xMax - xMin,
          height: yMax - yMin,
        });
      }
    }
  }

  return regions;
}

async function extractImageElements(
  moduleId: string,
  pageNumber: number,
  regions: ImageRegion[],
  referencePngBuffer: Buffer
): Promise<ModuleElementJson[]> {
  if (regions.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const refImage = await loadImage(referencePngBuffer);
  const elements: ModuleElementJson[] = [];

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const px = Math.max(0, Math.round(r.x * RENDER_SCALE));
    const py = Math.max(0, Math.round(r.y * RENDER_SCALE));
    const pw = Math.min(refImage.width - px, Math.round(r.width * RENDER_SCALE));
    const ph = Math.min(refImage.height - py, Math.round(r.height * RENDER_SCALE));
    if (pw <= 0 || ph <= 0) continue;

    const cropCanvas = createCanvas(pw, ph);
    const ctx = cropCanvas.getContext("2d");
    ctx.drawImage(refImage as any, px, py, pw, ph, 0, 0, pw, ph);
    const croppedBuffer = cropCanvas.toBuffer("image/png");

    const storagePath = `${moduleId}/page-${String(pageNumber).padStart(4, "0")}-img-${i}.png`;
    const { error } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .upload(storagePath, croppedBuffer, { contentType: "image/png", upsert: true });
    if (error) continue; // don't fail the whole page over one image — it stays out of elements, flagged as a warning by the caller

    elements.push({
      id: `el_${String(i).padStart(4, "0")}_image`,
      type: "IMAGE",
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      assetId: storagePath,
      confidence: "HIGH", // the crop is pixel-exact against the rendered page — no guessing involved
    });
  }

  return elements;
}

export async function extractPageElements(
  pdfDoc: any,
  moduleId: string,
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID",
  referencePngBuffer: Buffer
): Promise<{ elements: ModuleElementJson[]; warnings: { type: string; message: string }[] }> {
  const warnings: { type: string; message: string }[] = [];
  const page = await pdfDoc.getPage(pageNumber);

  let textElements: ModuleElementJson[] = [];
  if (pdfType !== "SCANNED") {
    textElements = await extractTextElements(page, pageHeight);
    warnings.push({
      type: "HEURISTIC_TEXT_GROUPING",
      message: "Text blocks and heading/question/option classification are heuristic — verify against the reference image.",
    });
  } else {
    warnings.push({
      type: "OCR_NOT_IMPLEMENTED",
      message: "This page has no text layer and OCR is not yet implemented — content is not extracted.",
    });
  }

  const pdfjsLib = await getPdfjsLib();
const imageRegions = await findImageRegions(page, pageHeight, pdfjsLib);
  const imageElements = await extractImageElements(moduleId, pageNumber, imageRegions, referencePngBuffer);
  if (imageRegions.length > imageElements.length) {
    warnings.push({
      type: "IMAGE_EXTRACTION_PARTIAL",
      message: `${imageRegions.length - imageElements.length} of ${imageRegions.length} detected images failed to extract.`,
    });
  }

  const elements = [...textElements, ...imageElements].sort((a, b) => a.y - b.y || a.x - b.x);

  return { elements, warnings };
}
