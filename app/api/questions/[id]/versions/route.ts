import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { name: true } }, publishedBy: { select: { name: true } } },
  });
  if (!question) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const versions = await prisma.questionVersion.findMany({
    where: { questionId: params.id },
    orderBy: { versionNumber: "desc" },
    include: { editedBy: { select: { name: true } } },
  });

  return NextResponse.json({
    question: {
      id: question.id,
      questionCode: question.questionCode,
      createdByName: question.createdBy?.name,
      createdAt: question.createdAt,
      isPublished: question.isPublished,
      publishedByName: question.publishedBy?.name,
      publishedAt: question.publishedAt,
    },
    versions,
  });
}
