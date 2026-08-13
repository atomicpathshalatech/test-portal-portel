import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildAnalytics } from "@/lib/scoring";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.attempt.findUnique({
    where: { id: params.id },
    include: {
      test: true,
      dpp: true,
      answers: { include: { question: { include: { translations: true } } } },
    },
  });
  if (!attempt || attempt.studentId !== session.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const container = attempt.test || attempt.dpp;
  if (!container) return NextResponse.json({ message: "Attempt has no test or DPP" }, { status: 500 });

  const { bySubject, byDifficulty } = buildAnalytics(
    attempt.answers as any,
    container.correctMarks,
    container.incorrectMarks
  );

  const totalStudents = attempt.testId
    ? await prisma.attempt.count({ where: { testId: attempt.testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } })
    : await prisma.attempt.count({ where: { dppId: attempt.dppId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } });

  // Full per-question breakdown for the Solutions Review section — only
  // meaningful once the attempt is actually finished (mid-attempt students
  // shouldn't be able to peek at answers via this endpoint).
  const isFinished = attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED";
  const questions = isFinished
    ? attempt.answers.map((a) => ({
        questionId: a.question.id,
        questionCode: a.question.questionCode,
        subject: a.question.subject,
        imageUrl: a.question.imageUrl,
        selectedOptionIds: a.selectedOptionIds,
        isCorrect: a.isCorrect,
        translations: a.question.translations.map((t) => ({
          language: t.language,
          statement: t.statement,
          options: t.options,
          correctOptionIds: t.correctOptionIds,
          solution: t.solution,
        })),
      }))
    : [];

  return NextResponse.json({
    status: attempt.status,
    score: attempt.score,
    rank: attempt.rank,
    totalStudents,
    isDpp: !!attempt.dppId,
    testId: attempt.testId,
    dppId: attempt.dppId,
    testName: attempt.test?.name || attempt.dpp?.name,
    bySubject,
    byDifficulty,
    questions,
  });
}
