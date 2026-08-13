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
  const in1Hour = new Date(now.getTime() + 60 * 60000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60000);

  const students = await prisma.user.findMany({ where: { role: "STUDENT", isActive: true }, select: { id: true } });
  let reminder1HourCount = 0;
  let reminder15Count = 0;
  let startCount = 0;
  let notAttemptedTestCount = 0;
  let dppPendingCount = 0;

  if (students.length > 0) {
    // 1-hour-before reminder
    const upcoming1Hour = await prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        openTime: { gt: in15, lte: in1Hour },
        reminder1HourSentAt: null,
      },
    });
    for (const test of upcoming1Hour) {
      const openTimeStr = test.openTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          type: "TEST_ONE_HOUR",
          title: "⏰ Test starts in 1 hour",
          message: `${test.name} starts at ${openTimeStr}. Get ready and attempt the test on time.`,
          deepLink: `/student/exam/${test.id}`,
        })),
      });
      await prisma.test.update({ where: { id: test.id }, data: { reminder1HourSentAt: now } });
      reminder1HourCount++;
    }

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
          type: "TEST_FIFTEEN_MINUTES",
          title: "⏰ Test starts in 15 minutes",
          message:
            "🤫 Stay in a quiet place\n💧 Keep a bottle of water with you\n📱 Keep your device charged\n📝 Keep pen and rough sheet ready\n🧠 Stay calm and focus\n\n" +
            `Your test "${test.name}" starts soon.`,
          deepLink: `/student/exam/${test.id}`,
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
          type: "TEST_STARTED",
          title: "🚀 Test is LIVE",
          message: `${test.name} has started. Attempt your test now.`,
          deepLink: `/student/exam/${test.id}`,
        })),
      });
      await prisma.test.update({ where: { id: test.id }, data: { startNotifiedAt: now } });
      startCount++;
    }

    // Test-not-attempted — once, shortly after closeTime, for tests where a
    // student never even started an attempt. Only ever runs once per test
    // (notAttemptedCheckedAt), so it can't spam students on later cron ticks.
    const justClosed = await prisma.test.findMany({
      where: {
        status: "PUBLISHED",
        closeTime: { lte: now },
        notAttemptedCheckedAt: null,
      },
    });
    for (const test of justClosed) {
      const attempted = await prisma.attempt.findMany({ where: { testId: test.id }, select: { studentId: true } });
      const attemptedIds = new Set(attempted.map((a) => a.studentId));
      const missed = students.filter((s) => !attemptedIds.has(s.id));
      if (missed.length > 0) {
        await prisma.notification.createMany({
          data: missed.map((s) => ({
            userId: s.id,
            type: "TEST_NOT_ATTEMPTED",
            title: "⚠️ Test Not Attempted",
            message: `You haven't attempted ${test.name}. Don't let one missed test break your consistency.`,
            deepLink: "/student/results",
          })),
        });
      }
      await prisma.test.update({ where: { id: test.id }, data: { notAttemptedCheckedAt: now } });
      notAttemptedTestCount++;
    }

    // DPP pending reminder — once, ~6 hours after publish, for students who
    // haven't completed it yet. Also one-shot per DPP (pendingReminderSentAt).
    const pendingDpps = await prisma.dpp.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: sixHoursAgo },
        pendingReminderSentAt: null,
      },
    });
    for (const dpp of pendingDpps) {
      const completed = await prisma.attempt.findMany({
        where: { dppId: dpp.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
        select: { studentId: true },
      });
      const completedIds = new Set(completed.map((a) => a.studentId));
      const pending = students.filter((s) => !completedIds.has(s.id));
      if (pending.length > 0) {
        await prisma.notification.createMany({
          data: pending.map((s) => ({
            userId: s.id,
            type: "DPP_PENDING",
            title: "📌 DPP Still Pending",
            message: `You haven't completed "${dpp.name}" yet. Take a few minutes and finish it.`,
            deepLink: `/student/dpp-attempt/${dpp.id}`,
          })),
        });
      }
      await prisma.dpp.update({ where: { id: dpp.id }, data: { pendingReminderSentAt: now } });
      dppPendingCount++;
    }
  }

  return NextResponse.json({
    reminder1HourCount,
    reminder15Count,
    startCount,
    notAttemptedTestCount,
    dppPendingCount,
    checkedAt: now.toISOString(),
  });
}
