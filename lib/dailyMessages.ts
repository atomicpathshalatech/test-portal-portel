import { prisma } from "@/lib/prisma";

// These exist ONLY to self-seed the DailyMessage table the first time each
// type is needed — after that, every message is a normal DB row admins can
// add/edit/delete/enable-disable from the admin panel. Nothing in the
// sending logic ever reads from this array directly.
const SEED_MESSAGES: Record<"MORNING" | "NIGHT", { title: string; body: string }[]> = {
  MORNING: [
    { title: "🌅 Good Morning, Champion!", body: "आज का छोटा effort ही कल का बड़ा result बनाएगा। बस आज का target पूरा करो. 💪" },
    { title: "☀️ Start Strong Today", body: "Perfect बनने की जरूरत नहीं है। बस आज कल से थोड़ा बेहतर perform करो." },
    { title: "🎯 Your Goal Is Waiting", body: "आज का एक focused study session आपकी preparation को आगे बढ़ा सकता है। शुरू करो." },
  ],
  NIGHT: [
    {
      title: "🌙 Day Check — कितना पूरा हुआ?",
      body: "आज का target complete हुआ?\nक्या आज का revision पूरा किया?\nकोई doubt बचा है?\n\nअगर कुछ समझ नहीं आया तो पूछ लो — हम यहीं हैं.",
    },
  ],
};

// Reliable IST calendar-date key regardless of the server's own timezone —
// en-CA formats as YYYY-MM-DD, which is what we want for a stable job key.
export function istDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Returns true if this is the first time we're running `jobKey` — false
// (and does nothing further) if it already ran. Call this BEFORE sending any
// notifications for a recurring job so a duplicate cron tick can't double-send.
export async function claimJobOnce(jobKey: string): Promise<boolean> {
  try {
    await prisma.scheduledJobLog.create({ data: { jobKey } });
    return true;
  } catch {
    return false; // unique constraint hit — already ran
  }
}

async function ensureSeeded(type: "MORNING" | "NIGHT") {
  const count = await prisma.dailyMessage.count({ where: { type } });
  if (count > 0) return;
  await prisma.dailyMessage.createMany({
    data: SEED_MESSAGES[type].map((m) => ({ type, title: m.title, body: m.body })),
  });
}

// Rotation: always pick the enabled message that was sent longest ago (or
// never sent), so the same message doesn't repeat until every other one in
// the pool has had a turn.
export async function pickNextMessage(type: "MORNING" | "NIGHT") {
  await ensureSeeded(type);
  // Never-sent messages take priority over ones that have gone through at
  // least one rotation already.
  const neverSent = await prisma.dailyMessage.findFirst({
    where: { type, enabled: true, lastSentAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (neverSent) return neverSent;
  return prisma.dailyMessage.findFirst({
    where: { type, enabled: true },
    orderBy: { lastSentAt: "asc" },
  });
}
