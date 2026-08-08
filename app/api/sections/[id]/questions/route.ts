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

  const section = await prisma.section.findUnique({ where: { id: params.id } });
  if (!section) return NextResponse.json({ message: "Section not found" }, { status: 404 });

  const existing = await prisma.sectionQuestion.findFirst({
    where: { sectionId: params.id, questionId },
  });
  if (existing) {
    return NextResponse.json({ message: "This question is already in the section" }, { status: 409 });
  }

  const count = await prisma.sectionQuestion.count({ where: { sectionId: params.id } });
  const link = await prisma.sectionQuestion.create({
    data: { sectionId: params.id, questionId, order: count },
  });
  await prisma.question.update({ where: { id: questionId }, data: { usageCount: { increment: 1 } } });

  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const questionId = req.nextUrl.searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ message: "questionId is required" }, { status: 400 });

  await prisma.sectionQuestion.deleteMany({ where: { sectionId: params.id, questionId } });
  return NextResponse.json({ deleted: true });
}
