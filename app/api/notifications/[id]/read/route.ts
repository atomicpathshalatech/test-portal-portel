import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const notification = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notification || notification.userId !== session.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  await prisma.notification.update({ where: { id: params.id }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
