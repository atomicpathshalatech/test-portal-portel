import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const bookmarks = await prisma.bookmark.findMany({
    where: { studentId: session.id },
    include: { question: { include: { translations: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(bookmarks);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { questionId } = await req.json();
  if (!questionId) return NextResponse.json({ message: "questionId is required" }, { status: 400 });

  const bookmark = await prisma.bookmark.upsert({
    where: { studentId_questionId: { studentId: session.id, questionId } },
    update: {},
    create: { studentId: session.id, questionId },
  });
  return NextResponse.json(bookmark, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const questionId = req.nextUrl.searchParams.get("questionId");
  if (!questionId) return NextResponse.json({ message: "questionId is required" }, { status: 400 });

  await prisma.bookmark
    .delete({ where: { studentId_questionId: { studentId: session.id, questionId } } })
    .catch(() => null); // already removed — fine
  return NextResponse.json({ deleted: true });
}
