import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const modules = await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      subject: true,
      class: true,
      status: true,
      pdfType: true,
      pageCount: true,
      originalFileName: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ modules });
}
