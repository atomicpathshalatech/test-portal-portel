import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const series = await prisma.testSeries.findUnique({
    where: { id: params.id },
    include: {
      tests: {
        orderBy: { openTime: "asc" },
        select: {
          id: true,
          name: true,
          durationMin: true,
          openTime: true,
          closeTime: true,
          status: true,
          sections: { select: { subject: true } },
        },
      },
    },
  });
  if (!series) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(series);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.testSeries.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.testSeries.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      code: body.code ?? existing.code,
      description: body.description ?? existing.description,
      tags: body.tags ?? existing.tags,
      thumbnailUrl: body.thumbnailUrl ?? existing.thumbnailUrl,
      examType: body.examType ?? existing.examType,
      course: body.course ?? existing.course,
      className: body.className ?? existing.className,
      visibility: body.visibility ?? existing.visibility,
      targetBatch: body.targetBatch ?? existing.targetBatch,
      startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
      endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
    },
  });

  await logAudit({
    userId: session.id,
    action: "EDIT_TEST_SERIES",
    entityType: "TestSeries",
    entityId: params.id,
    details: updated.name,
  });

  return NextResponse.json(updated);
}
