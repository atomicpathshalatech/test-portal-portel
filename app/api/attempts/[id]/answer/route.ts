import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getValidSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.attempt.findUnique({ where: { id: params.id } });
  if (!attempt || attempt.studentId !== session.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ message: "Attempt already submitted" }, { status: 409 });
  }

  const { questionId, selectedOptionIds, timeTakenSec } = await req.json();
  if (!questionId) {
    return NextResponse.json({ message: "questionId is required" }, { status: 400 });
  }

  const answer = await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId: params.id, questionId } },
    update: {
      selectedOptionIds: selectedOptionIds || [],
      timeTakenSec: timeTakenSec || 0,
    },
    create: {
      attemptId: params.id,
      questionId,
      selectedOptionIds: selectedOptionIds || [],
      timeTakenSec: timeTakenSec || 0,
    },
  });

  return NextResponse.json(answer);
}
