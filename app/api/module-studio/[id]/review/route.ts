import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const force = !!body.force;

  const mod = await prisma.module.findUnique({
    where: { id: params.id },
    include: { pages: { select: { needsReview: true } } },
  });
  if (!mod) return NextResponse.json({ message: "Module not found" }, { status: 404 });

  const pendingCount = mod.pages.filter((p) => p.needsReview).length;
  if (pendingCount > 0 && !force) {
    return NextResponse.json(
      { message: `${pendingCount} page(s) still flagged for review`, pendingCount },
      { status: 400 }
    );
  }

  const updated = await prisma.module.update({
    where: { id: mod.id },
    data: {
      reviewedById: session.id,
      reviewedAt: new Date(),
      status: "READY",
    },
  });

  await prisma.moduleVersion.create({
    data: {
      moduleId: mod.id,
      label: "Reviewed",
      snapshot: { reviewedAt: new Date().toISOString(), pendingCountAtReview: pendingCount },
      createdById: session.id,
    },
  });

  return NextResponse.json({ module: updated });
}
