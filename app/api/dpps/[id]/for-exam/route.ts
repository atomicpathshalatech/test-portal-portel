import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { translations: true } } },
      },
    },
  });
  if (!dpp) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (dpp.status !== "PUBLISHED") {
    return NextResponse.json({ message: "This DPP is not published yet" }, { status: 403 });
  }

  // Same shape as /api/tests/[id]/for-exam (one section) so the exam runtime
  // component can be reused without modification. Never send
  // correctOptionIds to the client during an active attempt.
  return NextResponse.json({
    id: dpp.id,
    name: dpp.name,
    languageMode: dpp.languageMode,
    durationMin: dpp.estimatedTimeMin,
    closeTime: null,
    sections: [
      {
        id: dpp.id,
        name: dpp.name,
        questions: dpp.questions.map((dq) => ({
          id: dq.question.id,
          difficulty: dq.question.difficulty,
          type: dq.question.type,
          imageUrl: dq.question.imageUrl,
          translations: dq.question.translations.map((t) => ({
            language: t.language,
            statement: t.statement,
            options: t.options,
          })),
        })),
      },
    ],
  });
}
