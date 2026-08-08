import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

function generateTestCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const original = await prisma.test.findUnique({
    where: { id: params.id },
    include: { sections: { include: { questions: true } } },
  });
  if (!original) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let code = generateTestCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.test.findUnique({ where: { code } });
    if (!exists) break;
    code = generateTestCode();
  }

  const duplicate = await prisma.test.create({
    data: {
      testSeriesId: original.testSeriesId,
      name: `${original.name} (Copy)`,
      description: original.description,
      code,
      testType: original.testType,
      examType: original.examType,
      questionFormat: original.questionFormat,
      instructions: original.instructions,
      languageMode: original.languageMode,
      durationMin: original.durationMin,
      openTime: original.openTime,
      closeTime: original.closeTime,
      correctMarks: original.correctMarks,
      incorrectMarks: original.incorrectMarks,
      negativeMarkingEnabled: original.negativeMarkingEnabled,
      status: "DRAFT", // always starts fresh, regardless of the original's status
      createdById: session.id,
      sections: {
        create: original.sections.map((sec) => ({
          name: sec.name,
          subject: sec.subject,
          targetCount: sec.targetCount,
          marksPerQuestion: sec.marksPerQuestion,
          negativeMarks: sec.negativeMarks,
          order: sec.order,
          questions: {
            // Same questions are reused (linked, not cloned) — review status
            // resets so the copy goes through its own fresh review.
            create: sec.questions.map((sq) => ({
              questionId: sq.questionId,
              order: sq.order,
              marksOverride: sq.marksOverride,
              negativeMarksOverride: sq.negativeMarksOverride,
              reviewStatus: "PENDING",
            })),
          },
        })),
      },
    },
  });

  await logAudit({
    userId: session.id,
    action: "DUPLICATE_TEST",
    entityType: "Test",
    entityId: duplicate.id,
    details: `Duplicated from "${original.name}"`,
  });

  return NextResponse.json(duplicate, { status: 201 });
}
