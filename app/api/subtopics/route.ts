import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const topic = req.nextUrl.searchParams.get("topic");
  if (!topic) return NextResponse.json([]);

  const rows = await prisma.question.findMany({
    where: { topic, subTopic: { not: null } },
    select: { subTopic: true },
    distinct: ["subTopic"],
    take: 50,
  });

  return NextResponse.json(rows.map((r) => r.subTopic).filter(Boolean));
}
