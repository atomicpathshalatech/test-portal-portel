import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { istDateKey, claimJobOnce, pickNextMessage } from "@/lib/dailyMessages";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") === "NIGHT" ? "NIGHT" : "MORNING";
  const now = new Date();
  const jobKey = `daily-message-${type.toLowerCase()}:${istDateKey(now)}`;

  const claimed = await claimJobOnce(jobKey);
  if (!claimed) {
    return NextResponse.json({ skipped: true, reason: "already sent today", jobKey });
  }

  const message = await pickNextMessage(type);
  if (!message) {
    return NextResponse.json({ sent: 0, reason: "no enabled messages configured" });
  }

  // Only active (not inactive/disabled) students get daily nudges — matches
  // the "quiet rules" requirement that inactive accounts stop receiving
  // automated notifications.
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: { id: true },
  });

  if (students.length > 0) {
    await prisma.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        type: type === "MORNING" ? "MORNING_MOTIVATION" : "NIGHT_CHECKIN",
        title: message.title,
        message: message.body,
        deepLink: type === "MORNING" ? "/student" : "/student/checkin",
      })),
    });
  }

  await prisma.dailyMessage.update({ where: { id: message.id }, data: { lastSentAt: now } });

  return NextResponse.json({ sent: students.length, messageId: message.id, jobKey });
}
