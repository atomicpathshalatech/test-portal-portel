import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { buildAnalytics, scoreAnswer } from "@/lib/scoring";
import { logAudit } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can trigger a recalculation" }, { status: 401 });
  }

  const test = await prisma.test.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ message: "Test not found" }, { status: 404 });

  const attempts = await prisma.attempt.findMany({
    where: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    include: { answers: { include: { question: { include: { translations: true } } } } },
  });

  let changedCount = 0;
  for (const attempt of attempts) {
    const { totalScore } = buildAnalytics(attempt.answers as any, test.correctMarks, test.incorrectMarks);

    for (const a of attempt.answers) {
      const translation =
        a.question.translations.find((t) => t.language === "en") || a.question.translations[0];
      const correct = (translation?.correctOptionIds as string[]) || [];
      const { isCorrect } = scoreAnswer(
        a.selectedOptionIds as string[],
        correct,
        test.correctMarks,
        test.incorrectMarks
      );
      if (isCorrect !== a.isCorrect) {
        await prisma.attemptAnswer.update({ where: { id: a.id }, data: { isCorrect } });
      }
    }

    if (totalScore !== attempt.score) {
      await prisma.attempt.update({ where: { id: attempt.id }, data: { score: totalScore } });
      changedCount++;

      // Notify the student their result changed, per the correction workflow.
      await prisma.notification.create({
        data: {
          userId: attempt.studentId,
          title: "Your result was updated",
          message: `A correction was made in "${test.name}". Your score and rank have been recalculated.`,
        },
      });
    }
  }

  // Re-rank everyone based on the (possibly) updated scores.
  const resubmitted = await prisma.attempt.findMany({
    where: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    orderBy: { score: "desc" },
  });
  await Promise.all(
    resubmitted.map((a, idx) => prisma.attempt.update({ where: { id: a.id }, data: { rank: idx + 1 } }))
  );

  await logAudit({
    userId: session.id,
    action: "RECALCULATE_RESULTS",
    entityType: "Test",
    entityId: test.id,
    details: `${test.name} — ${changedCount} attempt(s) rescored`,
  });

  return NextResponse.json({ totalAttempts: attempts.length, changedCount });
}
