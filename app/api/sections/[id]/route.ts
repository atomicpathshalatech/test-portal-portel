import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const section = await prisma.section.findUnique({
    where: { id: params.id },
    include: {
      test: { select: { id: true, name: true } },
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { translations: true } } },
      },
    },
  });
  if (!section) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(section);
}
