import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mod = await prisma.module.findUnique({
    where: { id: params.id },
    include: {
      pages: { orderBy: { pageNumber: "asc" } },
      brandProfile: true,
    },
  });
  if (!mod) return NextResponse.json({ message: "Module not found" }, { status: 404 });

  return NextResponse.json({ module: mod });
}
