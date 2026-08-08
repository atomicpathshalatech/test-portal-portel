import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { subject: true } });
  return NextResponse.json({ name: session.name, role: session.role, subject: user?.subject || null });
}
