import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; questionId: string } }
) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { reviewStatus } = await req.json();
  if (!["APPROVED", "REJECTED", "PENDING"].includes(reviewStatus)) {
    return NextResponse.json({ message: "Invalid review status" }, { status: 400 });
  }

  const link = await prisma.sectionQuestion.findFirst({
    where: { sectionId: params.id, questionId: params.questionId },
    include: { question: { select: { questionCode: true } } },
  });
  if (!link) return NextResponse.json({ message: "Not found in this section" }, { status: 404 });

  const updated = await prisma.sectionQuestion.update({
    where: { id: link.id },
    data: { reviewStatus },
  });

  await logAudit({
    userId: session.id,
    action: `QUESTION_${reviewStatus}`,
    entityType: "Question",
    entityId: params.questionId,
    details: link.question.questionCode || undefined,
  });

  return NextResponse.json(updated);
}
