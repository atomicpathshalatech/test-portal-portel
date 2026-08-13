import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { questionId } = await req.json();
  if (!questionId) return NextResponse.json({ message: "questionId is required" }, { status: 400 });

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return NextResponse.json({ message: "Question ID not found." }, { status: 404 });
  if (question.archived) {
    return NextResponse.json({ message: "Question is archived and cannot be imported." }, { status: 409 });
  }

  const existing = await prisma.dppQuestion.findFirst({ where: { dppId: params.id, questionId } });
  if (existing) {
    const position = await prisma.dppQuestion.count({ where: { dppId: params.id, order: { lt: existing.order } } });
    return NextResponse.json(
      { message: "Question already exists in this Test/DPP.", duplicate: true, existingPosition: position + 1 },
      { status: 409 }
    );
  }

  const count = await prisma.dppQuestion.count({ where: { dppId: params.id } });
  const link = await prisma.dppQuestion.create({
    data: { dppId: params.id, questionId, order: count },
  });
  await prisma.question.update({ where: { id: questionId }, data: { usageCount: { increment: 1 } } });

  return NextResponse.json(link, { status: 201 });
}
