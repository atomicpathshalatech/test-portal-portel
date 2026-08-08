import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier, isManagerTier, ownsOrManages } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      testSeries: { select: { name: true } },
      sections: {
        orderBy: { order: "asc" },
        include: { questions: { include: { question: { include: { translations: true } } } } },
      },
    },
  });
  if (!test) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(test);
}

// General edits: rename, reschedule (openTime), change duration, archive/unarchive.
// Any single field can be sent; only provided fields are updated.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.test.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!ownsOrManages(session.role, session.id, existing.createdById)) {
    return NextResponse.json({ message: "You can only edit your own tests" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.openTime !== undefined) data.openTime = new Date(body.openTime);
  if (body.durationMin !== undefined) data.durationMin = body.durationMin;
  if (body.archived !== undefined) data.archived = body.archived;

  // Reschedule / duration changes always recompute closeTime from the (possibly new) openTime + duration.
  if (body.openTime !== undefined || body.durationMin !== undefined) {
    const openTime = data.openTime || existing.openTime;
    const durationMin = data.durationMin ?? existing.durationMin;
    data.closeTime = new Date(openTime.getTime() + durationMin * 60000);
  }

  const updated = await prisma.test.update({ where: { id: params.id }, data });

  await logAudit({
    userId: session.id,
    action: body.archived !== undefined ? (body.archived ? "ARCHIVE_TEST" : "UNARCHIVE_TEST") : "EDIT_TEST",
    entityType: "Test",
    entityId: params.id,
    details: updated.name,
  });

  return NextResponse.json(updated);
}

// Any test can now be deleted — including published ones with student
// attempts — but this permanently destroys that data (results, rank,
// everything), so it's restricted to Super Admin once attempts exist, and
// the UI requires typing the test's name to confirm. Prefer Archive for
// tests you just want out of the active list; use Delete only when you
// genuinely want the data gone.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can delete a test" }, { status: 401 });
  }

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { attempts: { select: { id: true } }, sections: { select: { id: true } } },
  });
  if (!test) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (test.attempts.length > 0 && session.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { message: "This test has student attempts — only Super Admin can delete it." },
      { status: 403 }
    );
  }

  const { confirmCode } = await req.json().catch(() => ({ confirmCode: undefined }));
  if (test.status !== "DRAFT" || test.attempts.length > 0) {
    if (confirmCode !== test.code) {
      return NextResponse.json({ message: "Type the exact test Code to confirm this permanent deletion." }, { status: 400 });
    }
  }

  const sectionIds = test.sections.map((s) => s.id);
  const attemptIds = test.attempts.map((a) => a.id);

  await prisma.attemptAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } });
  await prisma.attemptViolation.deleteMany({ where: { attemptId: { in: attemptIds } } });
  await prisma.attempt.deleteMany({ where: { testId: params.id } });
  await prisma.questionReport.updateMany({ where: { testId: params.id }, data: { testId: null } });
  await prisma.sectionQuestion.deleteMany({ where: { sectionId: { in: sectionIds } } });
  await prisma.section.deleteMany({ where: { testId: params.id } });
  await prisma.test.delete({ where: { id: params.id } });

  await logAudit({
    userId: session.id,
    action: "DELETE_TEST",
    entityType: "Test",
    entityId: params.id,
    details: `${test.name} (${test.status}, ${attemptIds.length} attempt(s) removed)`,
  });

  return NextResponse.json({ deleted: true });
}
