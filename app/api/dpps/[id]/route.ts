import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier, isManagerTier, ownsOrManages } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      questions: { orderBy: { order: "asc" }, include: { question: { include: { translations: true } } } },
    },
  });
  if (!dpp) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (session.role === "STUDENT" && dpp.status !== "PUBLISHED") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(dpp);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const existing = await prisma.dpp.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!ownsOrManages(session.role, session.id, existing.createdById)) {
    return NextResponse.json({ message: "You can only edit your own DPPs" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = [
    "name", "topics", "facultyName", "difficulty", "level", "languageMode", "description", "tags",
    "instructions", "estimatedTimeMin", "correctMarks", "incorrectMarks", "negativeMarkingEnabled",
    "questionTargetCount", "status",
  ];
  const data: any = {};
  for (const key of allowed) if (body[key] !== undefined) data[key] = body[key];

  // Publishing requires a manager, same spirit as Test's publish gate.
  if (data.status === "PUBLISHED" && !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can publish a DPP" }, { status: 403 });
  }

  const updated = await prisma.dpp.update({ where: { id: params.id }, data });

  await logAudit({ userId: session.id, action: "EDIT_DPP", entityType: "Dpp", entityId: params.id, details: updated.name });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession();

  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json(
      { message: "Only Sub Admin / SuperAdmin can delete a DPP" },
      { status: 401 }
    );
  }

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
    include: {
      attempts: {
        select: { id: true },
      },
    },
  });

  if (!dpp) {
    return NextResponse.json(
      { message: "DPP not found" },
      { status: 404 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const attemptIds = dpp.attempts.map((attempt) => attempt.id);

      // 1. Delete student answers belonging to these DPP attempts
      if (attemptIds.length > 0) {
        await tx.attemptAnswer.deleteMany({
          where: {
            attemptId: {
              in: attemptIds,
            },
          },
        });

        // 2. Delete anti-cheating / integrity violation records
        await tx.attemptViolation.deleteMany({
          where: {
            attemptId: {
              in: attemptIds,
            },
          },
        });

        // 3. Delete the student attempts themselves
        await tx.attempt.deleteMany({
          where: {
            id: {
              in: attemptIds,
            },
          },
        });
      }

      // 4. Remove questions from this DPP
      // IMPORTANT: Questions themselves are NOT deleted.
      await tx.dppQuestion.deleteMany({
        where: {
          dppId: params.id,
        },
      });

      // 5. Finally delete the DPP
      await tx.dpp.delete({
        where: {
          id: params.id,
        },
      });
    });

    // 6. Keep an audit record even though the DPP is permanently deleted
    await logAudit({
      userId: session.id,
      action: "DELETE_DPP",
      entityType: "Dpp",
      entityId: params.id,
      details: `${dpp.name} (${dpp.code}) deleted permanently. ${dpp.attempts.length} student attempt(s) and their answer/violation records were also deleted.`,
    });

    return NextResponse.json({
      deleted: true,
      message:
        dpp.attempts.length > 0
          ? `DPP deleted successfully along with ${dpp.attempts.length} student attempt(s).`
          : "DPP deleted successfully.",
    });
  } catch (error) {
    console.error("[DELETE DPP]", error);

    return NextResponse.json(
      {
        message:
          "DPP could not be deleted because it is still referenced by other data.",
      },
      { status: 409 }
    );
  }
}
