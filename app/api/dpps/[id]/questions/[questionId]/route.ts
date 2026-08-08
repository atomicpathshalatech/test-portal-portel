import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; questionId: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const link = await prisma.dppQuestion.findFirst({ where: { dppId: params.id, questionId: params.questionId } });
  if (!link) return NextResponse.json({ message: "Not found" }, { status: 404 });

  await prisma.dppQuestion.delete({ where: { id: link.id } });
  return NextResponse.json({ deleted: true });
}
