import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { predictRank } from "@/lib/rankPredictor";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const marksStr = req.nextUrl.searchParams.get("marks");
  const category = req.nextUrl.searchParams.get("category") || "General";
  const yearStr = req.nextUrl.searchParams.get("year");

  if (!marksStr) {
    return NextResponse.json({ message: "marks is required" }, { status: 400 });
  }
  const marksEntered = Number(marksStr);

  // Default to the most recent year that has trend data for this category
  let year = yearStr ? Number(yearStr) : null;
  if (!year) {
    const latest = await prisma.rankTrendPoint.findFirst({
      where: { category },
      orderBy: { year: "desc" },
      select: { year: true },
    });
    year = latest?.year ?? null;
  }

  if (!year) {
    return NextResponse.json(
      {
        message: `No trend data available yet for ${category} category. Ask Admin to add previous-year marks-vs-rank data first (Admin → Rank Predictor — Trend Data).`,
      },
      { status: 404 }
    );
  }

  const points = await prisma.rankTrendPoint.findMany({ where: { year, category } });
  const prediction = predictRank(
    points.map((p) => ({ marks: p.marks, expectedRank: p.expectedRank })),
    marksEntered
  );

  if (!prediction) {
    return NextResponse.json({ message: "Could not compute a prediction" }, { status: 500 });
  }

  // Show a range rather than a single false-precision number.
  // Extrapolated predictions (outside the known data range) get a wider,
  // less confident margin.
  const marginPct = prediction.isExtrapolated ? 0.12 : 0.05;
  const margin = Math.max(50, Math.round(prediction.rank * marginPct));
  const rankRangeLow = Math.max(1, prediction.rank - margin);
  const rankRangeHigh = prediction.rank + margin;

  const confidence: "high" | "medium" | "low" = prediction.isExtrapolated
    ? "low"
    : points.length >= 4
    ? "high"
    : "medium";

  return NextResponse.json({
    year,
    category,
    marksEntered,
    estimatedRank: prediction.rank,
    rankRangeLow,
    rankRangeHigh,
    confidence,
    disclaimer: `Estimated using ${year} trend data for ${category} category. This is not an official NTA prediction — actual results can vary with exam difficulty and applicant pool changes.`,
  });
}
