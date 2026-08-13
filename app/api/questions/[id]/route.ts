import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier, ownsOrManages } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { validateQuestionPayload } from "@/lib/questionValidation";

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