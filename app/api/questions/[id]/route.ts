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
  if (!question) return NextResponse.json({ message: "Question not found" }, { status: 404 });

  // Rule 3: Teachers only ever see their own subject's questions.
  if (session.role === "TEACHER" && session.subject && question.subject !== session.subject) {
    return NextResponse.json({ message: "Question not found" }, { status: 404 });
  }

  return NextResponse.json(question);
}

// Body shape (same as POST /api/questions, plus an optional `reason` used
// only when the question is already published):
// {
//   subject, chapter, topic, subTopic, type, difficulty, category, pyqSource,
//   imageUrl, reason,
//   translations: {
//     hi: { statement, options: [{id,text}], correctOptionIds, solution },
//     en: { statement, options: [{id,text}], correctOptionIds, solution }
//   }
// }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.question.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ message: "Question not found" }, { status: 404 });
  if (session.role === "TEACHER" && session.subject && existing.subject !== session.subject) {
    return NextResponse.json({ message: "You can only edit questions in your own subject" }, { status: 403 });
  }

  const body = await req.json();

  // Lightweight path: toggling Archive doesn't touch content, so it skips
  // the full question validation below (which expects a complete payload).
  if (Object.keys(body).length === 1 && typeof body.archived === "boolean") {
    const updated = await prisma.question.update({ where: { id: params.id }, data: { archived: body.archived } });
    await logAudit({
      userId: session.id,
      action: body.archived ? "ARCHIVE_QUESTION" : "UNARCHIVE_QUESTION",
      entityType: "Question",
      entityId: params.id,
      details: updated.questionCode || undefined,
    });
    return NextResponse.json(updated);
  }

  let { subject, chapter, topic, subTopic, type, difficulty, translations, imageUrl, category, pyqSource, reason } = body;

  // Rule 3: a Teacher can't move a question to a different subject.
  if (session.role === "TEACHER") subject = existing.subject;

  const validationError = validateQuestionPayload({ chapter, topic, subTopic, type, translations });
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const translationRows = [];
  if (translations?.hi) translationRows.push({ language: "hi", ...translations.hi });
  if (translations?.en) translationRows.push({ language: "en", ...translations.en });

  await prisma.questionTranslation.deleteMany({ where: { questionId: params.id } });
  const updated = await prisma.question.update({
    where: { id: params.id },
    data: {
      subject: subject || existing.subject,
      chapter,
      topic,
      subTopic,
      type,
      difficulty,
      category: category || null,
      pyqSource: category === "PYQ" ? pyqSource || null : null,
      imageUrl: imageUrl ?? null,
      translations: { create: translationRows },
    },
    include: { translations: true },
  });

  // Post-Publish Audit Policy: once a question has been published, every
  // subsequent edit is version-tracked (snapshotting the state it became,
  // same convention the version-restore endpoint uses).
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
        reason: reason || "Edited",
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();

  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  // Permanent deletion is admin-only.
  if (
    session.role !== "SUPER_ADMIN" &&
    session.role !== "SUB_ADMIN"
  ) {
    return NextResponse.json(
      {
        message:
          "Only administrators can permanently delete questions.",
      },
      { status: 403 }
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: {
      translations: true,
      sectionLinks: true,
      dppLinks: true,
      attemptAnswers: true,
      bookmarks: true,
      versions: true,
      reports: true,
    },
  });

  if (!question) {
    return NextResponse.json(
      { message: "Question not found" },
      { status: 404 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Test question links
      await tx.sectionQuestion.deleteMany({
        where: { questionId: question.id },
      });

      // DPP question links
      await tx.dppQuestion.deleteMany({
        where: { questionId: question.id },
      });

      // Student attempt answers
      await tx.attemptAnswer.deleteMany({
        where: { questionId: question.id },
      });

      // Student bookmarks
      await tx.bookmark.deleteMany({
        where: { questionId: question.id },
      });

      // Student reports
      await tx.questionReport.deleteMany({
        where: { questionId: question.id },
      });

      // Published-question version history
      await tx.questionVersion.deleteMany({
        where: { questionId: question.id },
      });

      // Hindi / English translations
      await tx.questionTranslation.deleteMany({
        where: { questionId: question.id },
      });

      // Finally delete the question
      await tx.question.delete({
        where: { id: question.id },
      });
    });

    await logAudit({
      userId: session.id,
      action: "DELETE_QUESTION",
      entityType: "Question",
      entityId: question.id,
      details: JSON.stringify({
        questionCode: question.questionCode,
        subject: question.subject,
        chapter: question.chapter,
        wasPublished: question.isPublished,
        testUsages: question.sectionLinks.length,
        dppUsages: question.dppLinks.length,
        attemptAnswers: question.attemptAnswers.length,
        bookmarks: question.bookmarks.length,
        versions: question.versions.length,
        reports: question.reports.length,
      }),
    });

    return NextResponse.json({
      success: true,
      message: "Question permanently deleted.",
    });
  } catch (error) {
    console.error("[FORCE DELETE QUESTION]", error);

    return NextResponse.json(
      {
        message:
          "Question could not be deleted. No changes were made.",
      },
      { status: 500 }
    );
  }
}