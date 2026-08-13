import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { istDateKey } from "@/lib/dailyMessages";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const today = istDateKey(new Date());
  const startOfDay = new Date(`${today}T00:00:00+05:30`);
  const endOfDay = new Date(`${today}T23:59:59+05:30`);

  let checkIn = await prisma.dailyCheckIn.findUnique({
    where: { studentId_date: { studentId: session.id, date: today } },
  });
  if (!checkIn) {
    checkIn = await prisma.dailyCheckIn.create({ data: { studentId: session.id, date: today } });
  }

  const [testsAttemptedToday, dppCompletedToday, pendingDoubts] = await Promise.all([
    prisma.attempt.count({
      where: { studentId: session.id, testId: { not: null }, startedAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.attempt.count({
      where: {
        studentId: session.id,
        dppId: { not: null },
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        submittedAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.doubt.count({ where: { studentId: session.id, status: { in: ["OPEN", "IN_REVIEW"] } } }),
  ]);

  return NextResponse.json({ ...checkIn, testsAttemptedToday, dppCompletedToday, pendingDoubts });
}

export async function PATCH(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const today = istDateKey(new Date());
  const body = await req.json();
  const data: any = {};
  for (const key of ["targetCompleted", "revisionCompleted", "dppCompleted", "testCompleted", "hasDoubt"]) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const updated = await prisma.dailyCheckIn.upsert({
    where: { studentId_date: { studentId: session.id, date: today } },
    create: { studentId: session.id, date: today, ...data },
    update: data,
  });

  return NextResponse.json(updated);
}
