import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { translations: true } } },
          },
        },
      },
    },
  });
  if (!test) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const questionIds = test.sections.flatMap((s) => s.questions.map((sq) => sq.question.id));
  const answers = await prisma.attemptAnswer.findMany({
    where: { questionId: { in: questionIds }, attempt: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } },
  });

  const statsByQuestion = new Map<string, { correct: number; incorrect: number; unattempted: number }>();
  for (const qid of questionIds) statsByQuestion.set(qid, { correct: 0, incorrect: 0, unattempted: 0 });
  for (const a of answers) {
    const bucket = statsByQuestion.get(a.questionId);
    if (!bucket) continue;
    const selected = Array.isArray(a.selectedOptionIds) ? (a.selectedOptionIds as any[]) : [];
    if (selected.length === 0) bucket.unattempted++;
    else if (a.isCorrect) bucket.correct++;
    else bucket.incorrect++;
  }

  const questions = test.sections.flatMap((s) =>
    s.questions.map((sq) => ({
      id: sq.question.id,
      questionCode: sq.question.questionCode,
      subject: sq.question.subject,
      translations: sq.question.translations,
      stats: statsByQuestion.get(sq.question.id) || { correct: 0, incorrect: 0, unattempted: 0 },
    }))
  );

  return NextResponse.json({ testName: test.name, testStatus: test.status, questions });
}
