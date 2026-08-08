import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const state = req.nextUrl.searchParams.get("state");
  const city = req.nextUrl.searchParams.get("city");
  const institute = req.nextUrl.searchParams.get("institute");
  const batch = req.nextUrl.searchParams.get("batch");

  const attempts = await prisma.attempt.findMany({
    where: {
      testId: params.id,
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      student: {
        state: state || undefined,
        city: city || undefined,
        institute: institute || undefined,
        batch: batch || undefined,
      },
    },
    include: {
      student: {
        select: { id: true, name: true, state: true, city: true, institute: true, batch: true },
      },
    },
    orderBy: { score: "desc" },
  });

  // Distinct filter option lists — drawn from everyone who attempted this
  // test (not just the currently filtered set), so dropdowns stay stable.
  const allAttempts = await prisma.attempt.findMany({
    where: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    include: { student: { select: { state: true, city: true, institute: true, batch: true } } },
  });
  const distinct = (field: "state" | "city" | "institute" | "batch") =>
    Array.from(new Set(allAttempts.map((a) => a.student[field]).filter(Boolean))) as string[];

  return NextResponse.json({
    entries: attempts.map((a, idx) => ({
      rank: idx + 1, // rank within the current filtered view
      overallRank: a.rank, // rank across all attempts on this test
      studentId: a.student.id,
      name: a.student.name,
      state: a.student.state,
      city: a.student.city,
      institute: a.student.institute,
      batch: a.student.batch,
      score: a.score,
      isMe: a.student.id === session.id,
    })),
    filterOptions: {
      states: distinct("state"),
      cities: distinct("city"),
      institutes: distinct("institute"),
      batches: distinct("batch"),
    },
  });
}
