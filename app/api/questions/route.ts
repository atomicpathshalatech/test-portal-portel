import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { generateQuestionCode } from "@/lib/questionCode";
import { validateQuestionPayload } from "@/lib/questionValidation";

export async function GET(req: NextRequest) {
  const session = getSession();
  const subjectParam = req.nextUrl.searchParams.get("subject");
  const difficulty = req.nextUrl.searchParams.get("difficulty");
  const code = req.nextUrl.searchParams.get("code"); // exact lookup by Question ID

  // Rule 3: a Teacher only ever sees their own subject's questions,
  // regardless of what's requested in the query string.
  const subject = session?.role === "TEACHER" ? session.subject || "__none__" : subjectParam;

  const questions = await prisma.question.findMany({
    where: {
      subject: subject || undefined,
      difficulty: (difficulty as any) || undefined,
      questionCode: code ? code.trim().toUpperCase() : undefined,
    },
    include: { translations: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(questions);
}

// Body shape:
// {
//   subject, chapter, topic, subTopic, type, difficulty, category, pyqSource,
//   translations: {
//     hi: { statement, options: [{id,text}], correctOptionIds, solution },
//     en: { statement, options: [{id,text}], correctOptionIds, solution }
//   }
// }
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  let { subject, chapter, topic, subTopic, type, difficulty, translations, imageUrl, category, pyqSource } = body;

  // Rule 3: a Teacher can only add questions to their own assigned subject
  // — force it server-side so the client can't bypass this via the request body.
  if (session.role === "TEACHER") {
    if (!session.subject) {
      return NextResponse.json(
        { message: "Your account has no subject assigned — ask an Admin to set one." },
        { status: 403 }
      );
    }
    subject = session.subject;
  }

  if (!subject || !type || !difficulty || !translations || (!translations.hi && !translations.en)) {
    return NextResponse.json(
      { message: "subject, type, difficulty and at least one language translation are required" },
      { status: 400 }
    );
  }

  const validationError = validateQuestionPayload({ chapter, topic, subTopic, type, translations });
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  // Each translation carries its OWN solution now — students only ever see
  // the solution matching the language they're viewing the question in.
  const translationRows = [];
  if (translations.hi) translationRows.push({ language: "hi", ...translations.hi });
  if (translations.en) translationRows.push({ language: "en", ...translations.en });

  const questionCode = await generateQuestionCode(subject);

  const question = await prisma.question.create({
    data: {
      questionCode,
      subject,
      chapter,
      topic,
      subTopic,
      type,
      difficulty,
      category: category || null,
      pyqSource: category === "PYQ" ? pyqSource || null : null,
      imageUrl: imageUrl || null,
      createdById: session.id,
      translations: { create: translationRows },
    },
    include: { translations: true },
  });

  await logAudit({ userId: session.id, action: "CREATE_QUESTION", entityType: "Question", entityId: question.id, details: `${questionCode} (${subject})` });

  return NextResponse.json(question, { status: 201 });
}
