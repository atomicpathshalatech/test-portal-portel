import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") {
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
  if (test.status !== "PUBLISHED") {
    return NextResponse.json({ message: "This test is not published yet" }, { status: 403 });
  }

  // Never send correctOptionIds to the client during an active exam.
  const safeSections = test.sections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    questions: sec.questions.map((sq) => ({
      id: sq.question.id,
      difficulty: sq.question.difficulty,
      type: sq.question.type,
      imageUrl: sq.question.imageUrl,
      translations: sq.question.translations.map((t) => ({
        language: t.language,
        statement: t.statement,
        options: t.options,
      })),
    })),
  }));

  return NextResponse.json({
    id: test.id,
    name: test.name,
    languageMode: test.languageMode,
    durationMin: test.durationMin,
    closeTime: test.closeTime,
    sections: safeSections,
  });
}
