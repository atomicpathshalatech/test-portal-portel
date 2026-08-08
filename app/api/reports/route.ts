import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

// Student creates a report
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { questionId, testId, reasonTags, comment, screenshotUrl } = await req.json();
  if (!questionId || !reasonTags || reasonTags.length === 0) {
    return NextResponse.json({ message: "questionId and at least one reason are required" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) return NextResponse.json({ message: "Question not found" }, { status: 404 });

  // Auto-flag high priority for the most severe issue types.
  const highPriorityTags = ["WRONG_ANSWER", "WRONG_OPTION", "WRONG_SOLUTION"];
  const tags: string[] = Array.isArray(reasonTags) ? reasonTags : [reasonTags];
  const priority = tags.some((t) => highPriorityTags.includes(t)) ? "HIGH" : "MEDIUM";

  const report = await prisma.questionReport.create({
    data: {
      questionId,
      testId: testId || null,
      reasonTags: tags.join(","),
      comment: comment || null,
      screenshotUrl: screenshotUrl || null,
      priority,
      reportedById: session.id,
    },
  });

  // Notify everyone with edit authority over this question: Super Admin,
  // Sub Admin, the subject's Teacher(s), and the question's original creator.
  const notifyTargets = await prisma.user.findMany({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        { role: "SUB_ADMIN" },
        { role: "TEACHER", subject: question.subject },
        { id: question.createdById || undefined },
      ],
    },
    select: { id: true },
  });
  const uniqueIds = Array.from(new Set(notifyTargets.map((u) => u.id)));
  if (uniqueIds.length > 0) {
    await prisma.notification.createMany({
      data: uniqueIds.map((uid) => ({
        userId: uid,
        title: "🚨 New Question Report",
        message: `Question ${question.questionCode || question.id} was reported: ${tags.join(", ")}`,
      })),
    });
  }

  return NextResponse.json(report, { status: 201 });
}

// Admin-tier users list/filter reports
export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const priority = req.nextUrl.searchParams.get("priority");

  const reports = await prisma.questionReport.findMany({
    where: {
      status: status || undefined,
      priority: priority || undefined,
      // Rule 3: Teachers only see reports for their own subject's questions.
      question: session.role === "TEACHER" && session.subject ? { subject: session.subject } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      question: { select: { questionCode: true, subject: true } },
      reportedBy: { select: { name: true } },
      claimedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(reports);
}
