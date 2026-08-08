import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const count = await prisma.notification.count({ where: { userId: session.id, isRead: false } });
  return NextResponse.json({ count });
}
