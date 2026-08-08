import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { generateTestSeriesCode } from "@/lib/testSeriesCode";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const series = await prisma.testSeries.findMany({
    orderBy: { createdAt: "desc" },
    include: { tests: { select: { id: true, status: true } } },
  });
  return NextResponse.json(series);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ message: "Name is required" }, { status: 400 });
  }

  const code = await generateTestSeriesCode();

  const series = await prisma.testSeries.create({
    data: {
      name: body.name,
      code,
      description: body.description || null,
      tags: body.tags || null,
      thumbnailUrl: body.thumbnailUrl || null,
      targetBatch: body.targetBatch || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  await logAudit({ userId: session.id, action: "CREATE_TEST_SERIES", entityType: "TestSeries", entityId: series.id, details: `${series.name} (${code})` });

  return NextResponse.json(series, { status: 201 });
}
