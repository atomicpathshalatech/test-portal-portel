import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const session = getSession();
  // Restoring is a corrective action on published content — keep it to
  // managers, consistent with "Escalate" style resolution authority.
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can restore a version" }, { status: 401 });
  }

  const version = await prisma.questionVersion.findUnique({ where: { id: params.versionId } });
  if (!version || version.questionId !== params.id) {
    return NextResponse.json({ message: "Version not found" }, { status: 404 });
  }

  const { reason } = await req.json().catch(() => ({ reason: "" }));
  const snapshot = version.snapshot as any;

  // Apply the restored snapshot's data (excluding relational/meta fields)
  await prisma.questionTranslation.deleteMany({ where: { questionId: params.id } });
  const restored = await prisma.question.update({
    where: { id: params.id },
    data: {
      chapter: snapshot.chapter,
      topic: snapshot.topic,
      type: snapshot.type,
      difficulty: snapshot.difficulty,
      category: snapshot.category,
      pyqSource: snapshot.pyqSource,
      imageUrl: snapshot.imageUrl,
      translations: {
        create: (snapshot.translations || []).map((t: any) => ({
          language: t.language,
          statement: t.statement,
          options: t.options,
          correctOptionIds: t.correctOptionIds,
          solution: t.solution,
        })),
      },
    },
    include: { translations: true },
  });

  const lastVersion = await prisma.questionVersion.findFirst({
    where: { questionId: params.id },
    orderBy: { versionNumber: "desc" },
  });
  await prisma.questionVersion.create({
    data: {
      questionId: params.id,
      versionNumber: (lastVersion?.versionNumber || 0) + 1,
      editedById: session.id,
      reason: reason || `Restored to Version ${version.versionNumber}`,
      changeType: "RESTORE",
      snapshot: restored as any,
    },
  });

  await logAudit({
    userId: session.id,
    action: "RESTORE_QUESTION_VERSION",
    entityType: "Question",
    entityId: params.id,
    details: `Restored to v${version.versionNumber}`,
  });

  return NextResponse.json(restored);
}
