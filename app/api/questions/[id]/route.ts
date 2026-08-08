import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier, ownsOrManages } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { validateQuestionPayload } from "@/lib/questionValidation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { translations: true },
  });
  if (!question) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // Rule 3: a Teacher can only view/edit their own subject's questions.
  if (session.role === "TEACHER" && session.subject && session.subject !== question.subject) {
    return NextResponse.json({ message: "Not your subject" }, { status: 403 });
  }

  return NextResponse.json(question);
}

// Body shape matches the create endpoint: subject, chapter, topic, subTopic,
// type, difficulty, category, pyqSource, imageUrl, translations: { hi?, en? }
// — each translation now carries its own `solution` field.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.question.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (!ownsOrManages(session.role, session.id, existing.createdById)) {
    return NextResponse.json({ message: "You can only edit your own questions" }, { status: 403 });
  }
  if (session.role === "TEACHER" && session.subject && session.subject !== existing.subject) {
    return NextResponse.json({ message: "Not your subject" }, { status: 403 });
  }

  const body = await req.json();
  let { subject, chapter, topic, subTopic, type, difficulty, translations, imageUrl, category, pyqSource, reason } = body;

  // A Teacher can't move a question into a different subject via edit either.
  if (session.role === "TEACHER") {
    subject = existing.subject;
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

  // Replace both translations cleanly rather than trying to diff-update them.
  // Each translation carries its OWN solution — students only ever see the
  // solution matching the language they're viewing the question in.
  await prisma.questionTranslation.deleteMany({ where: { questionId: params.id } });
  const translationRows = [];
  if (translations.hi) translationRows.push({ language: "hi", ...translations.hi });
  if (translations.en) translationRows.push({ language: "en", ...translations.en });

  const updated = await prisma.question.update({
    where: { id: params.id },
    data: {
      subject,
      chapter,
      topic,
      subTopic,
      type,
      difficulty,
      category: category || null,
      pyqSource: category === "PYQ" ? pyqSource || null : null,
      imageUrl: imageUrl || null,
      translations: { create: translationRows },
    },
    include: { translations: true },
  });

  // Post-Publish Audit Policy: draft-stage edits are never tracked (this is
  // intentional — unlimited free editing before a question is ever
  // published). Once a question has been published at least once, every
  // subsequent edit creates a permanent, immutable version snapshot.
  if (existing.isPublished) {
    const lastVersion = await prisma.questionVersion.findFirst({
      where: { questionId: params.id },
      orderBy: { versionNumber: "desc" },
    });
    await prisma.questionVersion.create({
      data: {
        questionId: params.id,
        versionNumber: (lastVersion?.versionNumber || 0) + 1,
        editedById: session.id,
        reason: reason || "No reason provided",
        changeType: "EDIT",
        snapshot: updated as any,
      },
    });
  }

  await logAudit({
    userId: session.id,
    action: "EDIT_QUESTION",
    entityType: "Question",
    entityId: params.id,
    details: updated.questionCode || undefined,
  });

  return NextResponse.json(updated);
}
