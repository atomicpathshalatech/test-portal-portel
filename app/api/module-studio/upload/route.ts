import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { getSupabaseAdmin, MODULE_ORIGINALS_BUCKET } from "@/lib/supabaseAdmin";
import { prisma } from "@/lib/prisma";
import { generateModuleCode } from "@/lib/moduleCode";

// Large modules can run 100+ pages of scanned content — 100MB covers that
// while still rejecting obviously-wrong uploads.
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const rightsConfirmed = formData.get("rightsConfirmed") === "true";

  if (!file) {
    return NextResponse.json({ message: "No file provided" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ message: "Module title is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ message: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ message: "PDF must be under 100MB" }, { status: 400 });
  }
  if (!rightsConfirmed) {
    return NextResponse.json(
      { message: "You must confirm you have rights to edit and reproduce this material" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Real page count + first-page dimensions, read directly from the PDF —
  // not guessed, not deferred to a later "processing" step. Full per-page
  // layout extraction (text/image/table detection) is a later phase; this
  // is just structural metadata pdf-lib can give us immediately.
  let pageCount: number;
  let firstPageSize = { width: 595, height: 842 }; // A4 fallback if PDF has zero pages (shouldn't happen)
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
    if (pageCount > 0) {
      const first = pdfDoc.getPage(0);
      firstPageSize = { width: first.getWidth(), height: first.getHeight() };
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: `Could not read this PDF: ${err.message || "file may be corrupt"}` },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }

  const storagePath = `${randomUUID()}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(MODULE_ORIGINALS_BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { message: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const code = await generateModuleCode();

  const mod = await prisma.module.create({
    data: {
      code,
      title,
      subject: (formData.get("subject") as string) || null,
      class: (formData.get("class") as string) || null,
      batch: (formData.get("batch") as string) || null,
      chapter: (formData.get("chapter") as string) || null,
      facultyName: (formData.get("facultyName") as string) || null,
      academicYear: (formData.get("academicYear") as string) || null,
      status: "DRAFT",
      pdfType: "UNKNOWN", // real digital/scanned/hybrid detection is a later phase
      originalFileUrl: storagePath,
      originalFileName: file.name,
      originalFileSize: file.size,
      pageCount,
      rightsConfirmedById: session.id,
      rightsConfirmedAt: new Date(),
      createdById: session.id,
    },
  });

  // Placeholder page rows so the module has real, addressable pages from
  // the moment it's uploaded — dimensions are real (read above), elements
  // start empty since text/image extraction isn't implemented yet.
  await prisma.modulePage.createMany({
    data: Array.from({ length: pageCount }, (_, i) => ({
      moduleId: mod.id,
      pageNumber: i + 1,
      width: firstPageSize.width,
      height: firstPageSize.height,
      pdfType: "UNKNOWN" as const,
      elements: [],
      needsReview: true, // true until a real extraction pass runs
      warnings: [{ type: "NOT_EXTRACTED", message: "Page content has not been extracted yet" }],
    })),
  });

  await prisma.moduleVersion.create({
    data: {
      moduleId: mod.id,
      label: "Imported",
      snapshot: { pageCount, status: "DRAFT" },
      createdById: session.id,
    },
  });

  return NextResponse.json({ module: mod }, { status: 201 });
}
