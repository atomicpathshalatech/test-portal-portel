import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const type = req.nextUrl.searchParams.get("type");
  const messages = await prisma.dailyMessage.findMany({
    where: { type: type || undefined },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { type, title, body } = await req.json();
  if (!type || !title || !body || !["MORNING", "NIGHT"].includes(type)) {
    return NextResponse.json({ message: "type (MORNING/NIGHT), title and body are required" }, { status: 400 });
  }
  const created = await prisma.dailyMessage.create({ data: { type, title, body } });
  return NextResponse.json(created, { status: 201 });
}
