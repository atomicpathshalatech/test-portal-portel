import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Returns previous-year seats allotted near a given NEET rank — real MCC
// AIQ Round-1 outcomes, not a prediction. Widens the rank window a few
// times if too few rows are found nearby (e.g. very high/low ranks, or a
// category+course combo with sparse seats).
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rankStr = req.nextUrl.searchParams.get("rank");
  const category = req.nextUrl.searchParams.get("category") || undefined; // candidateCategory
  const course = req.nextUrl.searchParams.get("course") || undefined; // "MBBS" | "BDS" | ...
  const yearStr = req.nextUrl.searchParams.get("year");

  if (!rankStr) {
    return NextResponse.json({ message: "rank is required" }, { status: 400 });
  }
  const rank = Number(rankStr);
  if (!Number.isFinite(rank) || rank < 1) {
    return NextResponse.json({ message: "rank must be a positive number" }, { status: 400 });
  }

  let year = yearStr ? Number(yearStr) : null;
  if (!year) {
    const latest = await prisma.collegeAllotment.findFirst({ orderBy: { year: "desc" }, select: { year: true } });
    year = latest?.year ?? null;
  }

  if (!year) {
    return NextResponse.json(
      { message: "No college-allotment data available yet. Ask Admin to import a previous-year AIQ result." },
      { status: 404 }
    );
  }

  const baseWhere: any = { year };
  if (category) baseWhere.candidateCategory = category;
  if (course) baseWhere.course = course;

  const windows = [2000, 8000, 30000, 100000];
  let rows: any[] = [];
  for (const w of windows) {
    rows = await prisma.collegeAllotment.findMany({
      where: { ...baseWhere, rank: { gte: Math.max(1, rank - w), lte: rank + w } },
      orderBy: { rank: "asc" },
      take: 300,
    });
    if (rows.length >= 5) break;
  }

  rows.sort((a, b) => Math.abs(a.rank - rank) - Math.abs(b.rank - rank));
  const nearest = rows.slice(0, 20).sort((a, b) => a.rank - b.rank);

  return NextResponse.json({
    year,
    rankEntered: rank,
    category: category ?? "Any",
    course: course ?? "Any",
    results: nearest.map((r) => ({
      rank: r.rank,
      quota: r.quota,
      instituteName: r.instituteName,
      course: r.course,
      allottedCategory: r.allottedCategory,
      candidateCategory: r.candidateCategory,
      remarks: r.remarks,
    })),
    disclaimer: `Actual AIQ Round 1 seat allotments from ${year} — shows what rank got what college last time, NOT a guarantee for the current year. Cutoffs shift year to year with difficulty and applicant pool changes.`,
  });
}
