import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SYLLABUS } from "@/lib/syllabusData";

export type TestStatus = "LIVE" | "UPCOMING" | "COMPLETED" | "MISSED" | "AVAILABLE";

function computeStatus(test: { openTime: Date; closeTime: Date }, hasAttempt: boolean, now: Date): TestStatus {
  if (hasAttempt) return "COMPLETED";
  if (now < test.openTime) return "UPCOMING";
  if (now >= test.openTime && now <= test.closeTime) return "LIVE";
  return "MISSED"; // closed, never attempted
}

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const subjectParam = req.nextUrl.searchParams.get("subject") || "Physics";
  const now = new Date();

  // "Biology" is a merged browsing view over Botany + Zoology sections,
  // matching the same convention used when building tests (see
  // lib/syllabusData.ts's resolveBiologySubject).
  const subjectFilter = subjectParam === "Biology" ? { in: ["Botany", "Zoology"] } : { equals: subjectParam };

  const tests = await prisma.test.findMany({
    where: {
      status: "PUBLISHED",
      testType: "CHAPTER_TEST",
      chapter: { not: null },
      sections: { some: { subject: subjectFilter } },
    },
    include: {
      sections: { include: { questions: { select: { id: true } } } },
      attempts: { where: { studentId: session.id }, select: { id: true, status: true, score: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by chapter, numbered in syllabus order (falling back to
  // alphabetical for any chapter not found in the syllabus data, e.g. a
  // legacy/custom chapter name).
  const chapterOrder = Object.keys(SYLLABUS[subjectParam] || {});

  const byChapter = new Map<string, typeof tests>();
  for (const t of tests) {
    if (!t.chapter) continue;
    if (!byChapter.has(t.chapter)) byChapter.set(t.chapter, []);
    byChapter.get(t.chapter)!.push(t);
  }

  const chapters = Array.from(byChapter.entries())
    .sort((a, b) => {
      const ai = chapterOrder.indexOf(a[0]);
      const bi = chapterOrder.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map(([chapter, chapterTests], idx) => ({
      number: idx + 1,
      chapter,
      tests: chapterTests.map((t) => {
        const attempt = t.attempts[0];
        const questionCount = t.sections.reduce((sum, s) => sum + s.questions.length, 0);
        const totalMarks = questionCount * t.correctMarks;
        return {
          id: t.id,
          name: t.name,
          questionCount,
          totalMarks,
          durationMin: t.durationMin,
          openTime: t.openTime,
          closeTime: t.closeTime,
          status: computeStatus(t, !!attempt && attempt.status !== "IN_PROGRESS", now),
          isInProgress: attempt?.status === "IN_PROGRESS",
          score: attempt?.status !== "IN_PROGRESS" ? attempt?.score ?? null : null,
          attemptId: attempt?.id || null,
        };
      }),
    }));

  return NextResponse.json({ subject: subjectParam, chapters });
}
