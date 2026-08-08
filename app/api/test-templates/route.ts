import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function GET() {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const templates = await prisma.testTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { sections: { orderBy: { order: "asc" } }, createdBy: { select: { name: true } } },
  });
  return NextResponse.json(templates);
}

// body: { name, description?, sections: [{ name, subject, targetCount, marksPerQuestion?, negativeMarks? }] }
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { name, description, sections } = await req.json();
  if (!name || !sections || sections.length === 0) {
    return NextResponse.json({ message: "name and at least one section are required" }, { status: 400 });
  }

  const template = await prisma.testTemplate.create({
    data: {
      name,
      description: description || null,
      createdById: session.id,
      sections: {
        create: sections.map((s: any, idx: number) => ({
          name: s.name,
          subject: s.subject,
          targetCount: s.targetCount,
          marksPerQuestion: s.marksPerQuestion || null,
          negativeMarks: s.negativeMarks || null,
          order: idx,
        })),
      },
    },
    include: { sections: true },
  });

  return NextResponse.json(template, { status: 201 });
}
