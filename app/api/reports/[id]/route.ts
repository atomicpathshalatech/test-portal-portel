import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const report = await prisma.questionReport.findUnique({
    where: { id: params.id },
    include: {
      question: { include: { translations: true } },
      reportedBy: { select: { name: true, email: true } },
      claimedBy: { select: { name: true } },
    },
  });
  if (!report) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

// body: { action: "claim" | "release" | "resolve" | "reject", teacherNotes?, priority? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const report = await prisma.questionReport.findUnique({
    where: { id: params.id },
    include: { question: { select: { questionCode: true } } },
  });
  if (!report) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { action, teacherNotes, priority } = await req.json();

  if (action === "claim") {
    if (report.claimedById && report.claimedById !== session.id) {
      return NextResponse.json({ message: "This report is already claimed by someone else" }, { status: 409 });
    }
    const updated = await prisma.questionReport.update({
      where: { id: params.id },
      data: { claimedById: session.id, claimedAt: new Date(), status: "CLAIMED" },
    });
    return NextResponse.json(updated);
  }

  if (action === "release") {
    if (report.claimedById !== session.id) {
      return NextResponse.json({ message: "You can only release a report you claimed" }, { status: 403 });
    }
    const updated = await prisma.questionReport.update({
      where: { id: params.id },
      data: { claimedById: null, claimedAt: null, status: "NEW" },
    });
    return NextResponse.json(updated);
  }

  if (action === "resolve" || action === "reject") {
    const status = action === "resolve" ? "RESOLVED" : "REJECTED";
    const updated = await prisma.questionReport.update({
      where: { id: params.id },
      data: { status, teacherNotes: teacherNotes || report.teacherNotes, resolvedAt: new Date() },
    });

    await logAudit({
      userId: session.id,
      action: `REPORT_${status}`,
      entityType: "QuestionReport",
      entityId: params.id,
      details: report.question.questionCode || undefined,
    });

    // If resolved (question was actually corrected), notify the reporting
    // student that their report led to a fix.
    if (action === "resolve") {
      await prisma.notification.create({
        data: {
          userId: report.reportedById,
          title: "Your reported question was corrected",
          message: `Thanks for the report! Question ${report.question.questionCode || ""} has been fixed.`,
        },
      });
    }

    return NextResponse.json(updated);
  }

  if (priority) {
    const updated = await prisma.questionReport.update({ where: { id: params.id }, data: { priority } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
