import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await prisma.notification.updateMany({ where: { userId: session.id, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
