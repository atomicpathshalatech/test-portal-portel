import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, MODULE_ORIGINALS_BUCKET } from "@/lib/supabaseAdmin";
import { extractModuleContent } from "@/lib/modulePdfAnalysis";

// Same single-request execution-model caveat as /analyze — see that route's
// comment. This is the heavier of the two (per-page text grouping + image
// cropping), so it hits the serverless timeout at a lower page count.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mod = await prisma.module.findUnique({ where: { id: params.id } });
  if (!mod) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }
  if (mod.pdfType === "UNKNOWN") {
    return NextResponse.json({ message: "Run analysis before extracting content" }, { status: 400 });
  }

  const job = await prisma.processingJob.create({
    data: { moduleId: mod.id, stage: "EXTRACTING", progress: 0 },
  });

  try {
    await prisma.module.update({ where: { id: mod.id }, data: { status: "PROCESSING" } });

    const supabase = getSupabaseAdmin();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(MODULE_ORIGINALS_BUCKET)
      .download(mod.originalFileUrl);
    if (downloadError || !fileData) {
      throw new Error(downloadError?.message || "Could not download original PDF");
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());

    await extractModuleContent(mod.id, buffer, async (progress) => {
      await prisma.processingJob.update({ where: { id: job.id }, data: { progress } });
    });

    const finished = await prisma.processingJob.update({
      where: { id: job.id },
      data: { stage: "READY_FOR_REVIEW", progress: 100, finishedAt: new Date() },
    });

    return NextResponse.json({ job: finished });
  } catch (err: any) {
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { stage: "FAILED", errorMessage: err.message || "Unknown error", finishedAt: new Date() },
    });
    await prisma.module.update({ where: { id: mod.id }, data: { status: "FAILED" } });

    return NextResponse.json({ message: `Extraction failed: ${err.message}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.processingJob.findFirst({
    where: { moduleId: params.id, stage: { in: ["EXTRACTING", "READY_FOR_REVIEW", "FAILED"] } },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ job });
}
