import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

function generateTestCode() {
  return String(Math.floor(10000 + Math.random() * 90000)); // 5-digit unique-ish code
}

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("testSeriesId");
  const tests = await prisma.test.findMany({
    where: seriesId ? { testSeriesId: seriesId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { sections: { include: { questions: true } }, createdBy: { select: { name: true } } },
  });
  return NextResponse.json(tests);
}

// Step 1 of the two-step flow: this ONLY captures test metadata and defines
// sections with a target question count. It never accepts question IDs —
// questions are added afterwards from the "Open Test" screen.
//
// Body shape:
// {
//   testSeriesId, name, description, testType, examType, questionFormat,
//   instructions, languageMode, durationMin, openTime, closeTime,
//   correctMarks, incorrectMarks, negativeMarkingEnabled,
//   sections: [{ name, subject, targetCount, marksPerQuestion?, negativeMarks? }]
// }
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const {
    testSeriesId, name, description, testType, chapter, examType, questionFormat, instructions,
    languageMode, durationMin, openTime, closeTime, correctMarks, incorrectMarks,
    negativeMarkingEnabled, sections,
  } = body;

  if (!testSeriesId || !name || !durationMin || !openTime || !closeTime) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }
  if (!sections || sections.length === 0) {
    return NextResponse.json({ message: "Define at least one section" }, { status: 400 });
  }

  let code = generateTestCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.test.findUnique({ where: { code } });
    if (!exists) break;
    code = generateTestCode();
  }

  // Every new test starts as a DRAFT. Students only ever see PUBLISHED tests.
  const test = await prisma.test.create({
    data: {
      testSeriesId,
      name,
      code,
      description: description || null,
      testType: testType || null,
      chapter: testType === "CHAPTER_TEST" ? chapter || null : null,
      examType: examType || null,
      questionFormat: questionFormat || "OBJECTIVE",
      instructions: instructions || null,
      languageMode: languageMode || "BOTH",
      durationMin,
      openTime: new Date(openTime),
      closeTime: new Date(closeTime),
      correctMarks: correctMarks ?? 4,
      incorrectMarks: incorrectMarks ?? -1,
      negativeMarkingEnabled: negativeMarkingEnabled ?? true,
      status: "DRAFT",
      createdById: session.id,
      sections: {
        create: sections.map((s: any, idx: number) => ({
          name: s.name,
          subject: s.subject,
          targetCount: s.targetCount || 0,
          marksPerQuestion: s.marksPerQuestion ?? null,
          negativeMarks: s.negativeMarks ?? null,
          order: idx,
        })),
      },
    },
    include: { sections: true },
  });

  await logAudit({ userId: session.id, action: "CREATE_TEST", entityType: "Test", entityId: test.id, details: name });

  return NextResponse.json(test, { status: 201 });
}
