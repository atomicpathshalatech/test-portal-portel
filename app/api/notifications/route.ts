import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(notifications);
}

// Admin/Manager broadcast — body: { title, message, target: "ALL_STUDENTS" | email }
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { title, message, target } = await req.json();
  if (!title || !message || !target) {
    return NextResponse.json({ message: "title, message and target are required" }, { status: 400 });
  }

  let recipients: { id: string }[];
  if (target === "ALL_STUDENTS") {
    recipients = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });
  } else {
    const user = await prisma.user.findUnique({ where: { email: target }, select: { id: true } });
    if (!user) return NextResponse.json({ message: "No user found with that email" }, { status: 404 });
    recipients = [user];
  }

  if (recipients.length === 0) {
    return NextResponse.json({ message: "No recipients matched" }, { status: 404 });
  }

  await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, title, message })),
  });

  await logAudit({
    userId: session.id,
    action: "SEND_NOTIFICATION",
    entityType: "Notification",
    details: `${title} → ${target} (${recipients.length} recipient${recipients.length > 1 ? "s" : ""})`,
  });

  return NextResponse.json({ sent: recipients.length }, { status: 201 });
}
