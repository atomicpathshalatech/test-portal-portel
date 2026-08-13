import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier, isManagerTier, ownsOrManages } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const VALID_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "PUBLISHED"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { sections: { include: { questions: true } } },
  });
  if (!test) return NextResponse.json({ message: "Test not found" }, { status: 404 });

  // Rule 4 — Test Approval Workflow (Draft -> Under Review -> Approved -> Published):
  //   DRAFT -> UNDER_REVIEW : the test's own creator (Teacher) or any manager, once every
  //                           section has reached its target question count.
  //   UNDER_REVIEW -> APPROVED : Sub Admin / Super Admin only, and only once EVERY question
  //                              in the test has been individually approved in Review Mode.
  //   APPROVED -> PUBLISHED : Sub Admin / Super Admin only.
  //   anything -> DRAFT : managers (or the creator, for their own test) can send it back.
  const isOwnerOrManager = ownsOrManages(session.role, session.id, test.createdById);
  const totalQuestions = test.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const totalTarget = test.sections.reduce((s, sec) => s + sec.targetCount, 0);
  const approvedCount = test.sections.reduce(
    (s, sec) => s + sec.questions.filter((q) => q.reviewStatus === "APPROVED").length,
    0
  );

  if (status === "UNDER_REVIEW") {
    if (!isOwnerOrManager) {
      return NextResponse.json({ message: "Only the test's creator or a manager can submit it for review" }, { status: 403 });
    }
    if (totalTarget === 0 || totalQuestions < totalTarget) {
      return NextResponse.json(
        { message: `All sections must reach their target question count first (${totalQuestions}/${totalTarget} added).` },
        { status: 400 }
      );
    }
  }
  if (status === "APPROVED") {
    if (!isManagerTier(session.role)) {
      return NextResponse.json({ message: "Only Sub Admin / Super Admin can approve a test" }, { status: 403 });
    }
    if (totalQuestions === 0 || approvedCount < totalQuestions) {
      return NextResponse.json(
        { message: `Every question must be individually approved in Review Mode first (${approvedCount}/${totalQuestions} approved).` },
        { status: 400 }
      );
    }
  }
  if (status === "PUBLISHED" && !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can publish a test" }, { status: 403 });
  }
  if (status === "DRAFT" && !isOwnerOrManager) {
    return NextResponse.json({ message: "Only the test's creator or a manager can revert it to draft" }, { status: 403 });
  }

  const updated = await prisma.test.update({ where: { id: params.id }, data: { status } });

  // Reverting to DRAFT resets every question's review status, so re-review
  // starts clean the next time it's submitted.
  if (status === "DRAFT") {
    const questionIds = test.sections.flatMap((sec) => sec.questions.map((q) => q.id));
    if (questionIds.length > 0) {
      await prisma.sectionQuestion.updateMany({ where: { id: { in: questionIds } }, data: { reviewStatus: "PENDING" } });
    }
  }

  await logAudit({
    userId: session.id,
    action: `TEST_STATUS_${status}`,
    entityType: "Test",
    entityId: test.id,
    details: test.name,
  });

  // Auto-notify students the moment a test goes live for them to see.
  if (status === "PUBLISHED" && test.status !== "PUBLISHED") {
    const students = await prisma.user.findMany({ where: { role: "STUDENT", isActive: true }, select: { id: true } });
    if (students.length > 0) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.id,
          type: "TEST_PUBLISHED",
          title: "New test published",
          message: `${test.name} is now available. Check your dashboard for schedule details.`,
          deepLink: `/student/exam/${test.id}`,
        })),
      });
    }

    // Post-Publish Audit Policy: the moment a question is first published,
    // record who/when — from this point on, every edit to it is version-tracked.
    const questionIds = Array.from(new Set(test.sections.flatMap((sec) => sec.questions.map((q) => q.questionId))));
    if (questionIds.length > 0) {
      await prisma.question.updateMany({
        where: { id: { in: questionIds }, isPublished: false },
        data: { isPublished: true, publishedById: session.id, publishedAt: new Date() },
      });
    }
  }

  return NextResponse.json(updated);
}
