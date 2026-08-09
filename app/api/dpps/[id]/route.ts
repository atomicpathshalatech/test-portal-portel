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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can delete a DPP" }, { status: 401 });
  }
  const dpp = await prisma.dpp.findUnique({ where: { id: params.id }, include: { attempts: { select: { id: true } } } });
  if (!dpp) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (dpp.attempts.length > 0) {
    return NextResponse.json({ message: "Cannot delete a DPP that already has student attempts." }, { status: 400 });
  }

  await prisma.dppQuestion.deleteMany({ where: { dppId: params.id } });
  await prisma.dpp.delete({ where: { id: params.id } });

  await logAudit({ userId: session.id, action: "DELETE_DPP", entityType: "Dpp", entityId: params.id, details: dpp.name });

  return NextResponse.json({ deleted: true });
}
