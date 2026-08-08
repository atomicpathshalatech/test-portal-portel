import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const year = req.nextUrl.searchParams.get("year");
  const points = await prisma.rankTrendPoint.findMany({
    where: {
      category: category || undefined,
      year: year ? Number(year) : undefined,
    },
    orderBy: [{ category: "asc" }, { marks: "desc" }],
  });
  return NextResponse.json(points);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { category, marks, expectedRank, year } = await req.json();
  if (!category || marks == null || expectedRank == null) {
    return NextResponse.json(
      { message: "category, marks and expectedRank are required" },
      { status: 400 }
    );
  }

  const point = await prisma.rankTrendPoint.upsert({
    where: {
      category_marks_year: {
        category,
        marks: Number(marks),
        year: year ? Number(year) : 2026,
      },
    },
    update: { expectedRank: Number(expectedRank) },
    create: {
      category,
      marks: Number(marks),
      expectedRank: Number(expectedRank),
      year: year ? Number(year) : 2026,
    },
  });

  return NextResponse.json(point, { status: 201 });
}
