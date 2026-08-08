import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// body: { language: "hi"|"en", correctOptionIds?: string[], solution?: string }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { language, correctOptionIds, solution } = await req.json();

  const question = await prisma.question.findUnique({ where: { id: params.id } });
  if (!question) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (correctOptionIds && language) {
    await prisma.questionTranslation.updateMany({
      where: { questionId: params.id, language },
      data: { correctOptionIds },
    });
  }
  if (solution !== undefined && language) {
    await prisma.questionTranslation.updateMany({
      where: { questionId: params.id, language },
      data: { solution },
    });
  }

  await logAudit({
    userId: session.id,
    action: "CORRECT_QUESTION",
    entityType: "Question",
    entityId: params.id,
    details: `${question.questionCode || params.id}${correctOptionIds ? " — answer key changed" : ""}`,
  });

  return NextResponse.json({ ok: true });
}
