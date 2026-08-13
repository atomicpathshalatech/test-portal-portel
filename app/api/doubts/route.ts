import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { subject, chapter, topic, message, imageUrl } = await req.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ message: "Please describe your doubt." }, { status: 400 });
  }

  const doubt = await prisma.doubt.create({
    data: {
      studentId: session.id,
      subject: subject || null,
      chapter: chapter || null,
      topic: topic || null,
      message,
      imageUrl: imageUrl || null,
    },
  });

  // Notify teachers of the relevant subject (and managers) that a new doubt
  // needs attention — mirrors the question-report notification pattern.
  const notifyTargets = await prisma.user.findMany({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        { role: "SUB_ADMIN" },
        subject ? { role: "TEACHER", subject } : { role: "TEACHER" },
      ],
    },
    select: { id: true },
  });
  const uniqueIds = Array.from(new Set(notifyTargets.map((u) => u.id)));
  if (uniqueIds.length > 0) {
    await prisma.notification.createMany({
      data: uniqueIds.map((uid) => ({
        userId: uid,
        type: "DOUBT_SUBMITTED",
        title: "❓ New Doubt Submitted",
        message: `A student asked a doubt${subject ? ` in ${subject}` : ""}.`,
        deepLink: `/admin/doubts/${doubt.id}`,
      })),
    });
  }

  return NextResponse.json(doubt, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const isAdmin = isAdminTier(session.role);

  const doubts = await prisma.doubt.findMany({
    where: {
      status: status || undefined,
      studentId: isAdmin ? undefined : session.id,
      subject: isAdmin && session.role === "TEACHER" && session.subject ? session.subject : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { name: true, studentIdCode: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return NextResponse.json(doubts);
}
