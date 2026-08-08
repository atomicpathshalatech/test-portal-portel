import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Vercel Cron sends a Bearer token matching CRON_SECRET when configured —
// this stops randoms from spamming this endpoint and mass-triggering
// notifications. Optional: if CRON_SECRET isn't set, the check is skipped
// (fine for local testing).
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in15 = new Date(now.getTime() + 15 * 60000);

  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });
  let reminder15Count = 0;
  let startCount = 0;

  if (students.length > 0) {
    // 15-minutes-before reminder — tests whose openTime falls in the next
    // ~15 min window and haven't been reminded yet.
    const upcoming = await prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        openTime: { gt: now, lte: in15 },
        reminder15SentAt: null,
      },
    });
    for (const test of upcoming) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          title: "Test starting soon",
          message: `${test.name} will begin in about 15 minutes.`,
        })),
      });
      await prisma.test.update({ where: { id: test.id }, data: { reminder15SentAt: now } });
      reminder15Count++;
    }

    // Start-time notification — tests whose openTime has just passed and
    // haven't been notified yet.
    const justStarted = await prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        openTime: { lte: now },
        closeTime: { gt: now },
        startNotifiedAt: null,
      },
    });
    for (const test of justStarted) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          title: "Test has started",
          message: `${test.name} is live now. Good luck!`,
        })),
      });
      await prisma.test.update({ where: { id: test.id }, data: { startNotifiedAt: now } });
      startCount++;
    }
  }

  return NextResponse.json({ reminder15Count, startCount, checkedAt: now.toISOString() });
}
