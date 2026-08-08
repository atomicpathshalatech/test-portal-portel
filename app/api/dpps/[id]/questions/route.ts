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

  const existing = await prisma.dppQuestion.findFirst({ where: { dppId: params.id, questionId } });
  if (existing) return NextResponse.json(existing);

  const count = await prisma.dppQuestion.count({ where: { dppId: params.id } });
  const link = await prisma.dppQuestion.create({
    data: { dppId: params.id, questionId, order: count },
  });
  await prisma.question.update({ where: { id: questionId }, data: { usageCount: { increment: 1 } } });

  return NextResponse.json(link, { status: 201 });
}
