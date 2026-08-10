import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, MODULE_ORIGINALS_BUCKET } from "@/lib/supabaseAdmin";
import { analyzeModulePdf } from "@/lib/modulePdfAnalysis";

// NOTE ON EXECUTION MODEL: this runs the whole per-page render loop inside
// one request/response cycle. That's fine for modules up to roughly 20-30
// pages within Vercel's serverless function timeout (10s Hobby / 60s Pro by
// default, configurable up to 800s on Pro+Fluid Compute). For the
// 100-200+ page modules the spec calls for (§38, §41), this MUST move to a
// real background job — e.g. a queue (Inngest, QStash, or a Postgres-backed
// job table polled by a worker) that processes pages in batches and updates
// the same ProcessingJob row this route already writes to. This route's
// progress-tracking shape (stage/progress/errorMessage on ProcessingJob) is
// written so that migration doesn't require a schema change — only the
// execution trigger changes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mod = await prisma.module.findUnique({ where: { id: params.id } });
  if (!mod) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }

  const job = await prisma.processingJob.create({
    data: { moduleId: mod.id, stage: "ANALYZING", progress: 0 },
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

    await analyzeModulePdf(mod.id, buffer, async (progress, stage) => {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { progress, stage: "RECONSTRUCTING_LAYOUT" },
      });
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

    return NextResponse.json(
      { message: `Analysis failed: ${err.message}` },
      { status: 500 }
    );
  }
}

// Poll the most recent job's progress — used by the "Analyze" button on the
// module detail page while POST above is in flight from a separate request.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.processingJob.findFirst({
    where: { moduleId: params.id },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ job });
}
