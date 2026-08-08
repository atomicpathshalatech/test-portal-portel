import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const entityId = req.nextUrl.searchParams.get("entityId");
  const logs = await prisma.auditLog.findMany({
    where: entityId ? { entityId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, role: true } } },
  });
  return NextResponse.json(logs);
}
