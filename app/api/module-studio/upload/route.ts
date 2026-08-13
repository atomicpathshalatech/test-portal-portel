import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { getSupabaseAdmin, MODULE_ORIGINALS_BUCKET } from "@/lib/supabaseAdmin";
import { prisma } from "@/lib/prisma";
import { generateModuleCode } from "@/lib/moduleCode";

const MAX_SIZE_BYTES = 100 * 1024 * 1024;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession();
    if (!session || !isAdminTier(session.role)) {
      return jsonError("Unauthorized", 401);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formString(formData, "title");
    const rightsConfirmed = formData.get("rightsConfirmed") === "true";

    if (!file) {
      return jsonError("No file provided", 400);
    }
    if (!title) {
      return jsonError("Module title is required", 400);
    }
    if (!isPdfFile(file)) {
      return jsonError("Only PDF files are accepted", 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return jsonError("PDF must be under 100MB", 400);
    }
    if (!rightsConfirmed) {
      return jsonError("You must confirm you have rights to edit and reproduce this material", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let pageCount: number;
    let firstPageSize = { width: 595, height: 842 };
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
      if (pageCount === 0) {
        return jsonError("This PDF has no pages", 400);
      }

      const first = pdfDoc.getPage(0);
      firstPageSize = { width: first.getWidth(), height: first.getHeight() };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "file may be corrupt";
      return jsonError(`Could not read this PDF: ${detail}`, 400);
    }

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Supabase is not configured";
      return jsonError(detail, 500);
    }

    const storagePath = `${randomUUID()}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(MODULE_ORIGINALS_BUCKET)
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      return jsonError(`Upload failed: ${uploadError.message}`, 500);
    }

    const code = await generateModuleCode();
    const mod = await prisma.module.create({
      data: {
        code,
        title,
        subject: formString(formData, "subject"),
        class: formString(formData, "class"),
        batch: formString(formData, "batch"),
        chapter: formString(formData, "chapter"),
        facultyName: formString(formData, "facultyName"),
        academicYear: formString(formData, "academicYear"),
        status: "DRAFT",
        pdfType: "UNKNOWN",
        originalFileUrl: storagePath,
        originalFileName: file.name,
        originalFileSize: file.size,
        pageCount,
        rightsConfirmedById: session.id,
        rightsConfirmedAt: new Date(),
        createdById: session.id,
      },
    });

    await prisma.modulePage.createMany({
      data: Array.from({ length: pageCount }, (_, i) => ({
        moduleId: mod.id,
        pageNumber: i + 1,
        width: firstPageSize.width,
        height: firstPageSize.height,
        pdfType: "UNKNOWN" as const,
        elements: [],
        needsReview: true,
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
  } catch (err) {
    console.error("[MODULE UPLOAD]", err);
    const detail = err instanceof Error ? err.message : "Unexpected upload error";
    return jsonError(`Upload failed: ${detail}`, 500);
  }
}
