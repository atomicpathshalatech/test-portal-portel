import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const bookmarks = await prisma.bookmark.findMany({
    where: { studentId: session.id },
    select: { questionId: true },
  });
  return NextResponse.json(bookmarks.map((b) => b.questionId));
}
