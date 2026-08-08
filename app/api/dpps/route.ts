import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { generateDppCode } from "@/lib/dppCode";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const subject = req.nextUrl.searchParams.get("subject");
  const chapter = req.nextUrl.searchParams.get("chapter");
  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search");

  // Students only ever see published DPPs; admin-tier sees everything
  // (or can filter by status themselves).
  const isStudent = session.role === "STUDENT";

  const dpps = await prisma.dpp.findMany({
    where: {
      subject: subject || undefined,
      chapter: chapter || undefined,
      status: isStudent ? "PUBLISHED" : status || undefined,
      name: search ? { contains: search, mode: "insensitive" } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      questions: { select: { id: true } },
      attempts: isStudent ? { where: { studentId: session.id }, select: { id: true, status: true } } : false,
    },
  });

  return NextResponse.json(dpps);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, subject, chapter, topic, facultyName, difficulty, languageMode, description, tags, instructions, estimatedTimeMin, correctMarks, incorrectMarks, negativeMarkingEnabled, questionTargetCount } = body;

  if (!name || !subject || !chapter) {
    return NextResponse.json({ message: "name, subject and chapter are required" }, { status: 400 });
  }
  // Rule 3: a Teacher can only create DPPs for their own subject.
  if (session.role === "TEACHER" && session.subject && subject !== session.subject) {
    return NextResponse.json({ message: "You can only create DPPs for your assigned subject" }, { status: 403 });
  }

  const code = await generateDppCode();

  const dpp = await prisma.dpp.create({
    data: {
      code,
      name,
      subject,
      chapter,
      topic: topic || null,
      facultyName: facultyName || null,
      difficulty: difficulty || "MEDIUM",
      languageMode: languageMode || "BOTH",
      description: description || null,
      tags: tags || null,
      instructions: instructions || null,
      estimatedTimeMin: estimatedTimeMin || 30,
      correctMarks: correctMarks ?? 4,
      incorrectMarks: incorrectMarks ?? -1,
      negativeMarkingEnabled: negativeMarkingEnabled ?? true,
      questionTargetCount: questionTargetCount || 0,
      createdById: session.id,
    },
  });

  await logAudit({ userId: session.id, action: "CREATE_DPP", entityType: "Dpp", entityId: dpp.id, details: `${dpp.name} (${code})` });

  return NextResponse.json(dpp, { status: 201 });
}
