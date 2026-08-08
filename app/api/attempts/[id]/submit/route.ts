import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidSession } from "@/lib/auth";
import { buildAnalytics, scoreAnswer } from "@/lib/scoring";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getValidSession();
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
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ message: "Already submitted" }, { status: 409 });
  }

  // Works for either a Test or a DPP attempt — both expose the same
  // correctMarks/incorrectMarks shape, so scoring logic is identical.
  const container = attempt.test || attempt.dpp;
  if (!container) return NextResponse.json({ message: "Attempt has no test or DPP" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const isAutoSubmit = body?.reason === "AUTO";

  const { totalScore, bySubject, byDifficulty } = buildAnalytics(
    attempt.answers as any,
    container.correctMarks,
    container.incorrectMarks
  );

  // Persist per-answer correctness (useful for review screens / audit)
  for (const a of attempt.answers) {
    const translation =
      a.question.translations.find((t) => t.language === "en") || a.question.translations[0];
    const correct = (translation?.correctOptionIds as string[]) || [];
    const { isCorrect } = scoreAnswer(
      a.selectedOptionIds as string[],
      correct,
      container.correctMarks,
      container.incorrectMarks
    );
    await prisma.attemptAnswer.update({ where: { id: a.id }, data: { isCorrect } });
  }

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      status: isAutoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED",
      submittedAt: new Date(),
      score: totalScore,
    },
  });

  // Recompute rank for everyone who has submitted this test/DPP (simple MVP
  // approach; fine for moderate sizes, move to a background job for very
  // large cohorts). DPPs are practice-only, so ranking is less critical
  // there, but kept for consistency (e.g. a future "DPP leaderboard").
  const submittedAttempts = await prisma.attempt.findMany({
    where: attempt.testId
      ? { testId: attempt.testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }
      : { dppId: attempt.dppId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    orderBy: { score: "desc" },
  });
  await Promise.all(
    submittedAttempts.map((a, idx) =>
      prisma.attempt.update({ where: { id: a.id }, data: { rank: idx + 1 } })
    )
  );

  return NextResponse.json({ totalScore, bySubject, byDifficulty });
}
