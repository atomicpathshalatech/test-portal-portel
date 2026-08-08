import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; questionId: string } }
) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { marksOverride, negativeMarksOverride } = await req.json();

  const link = await prisma.sectionQuestion.findFirst({
    where: { sectionId: params.id, questionId: params.questionId },
  });
  if (!link) return NextResponse.json({ message: "Not found in this section" }, { status: 404 });

  const updated = await prisma.sectionQuestion.update({
    where: { id: link.id },
    data: {
      marksOverride: marksOverride === undefined ? undefined : marksOverride,
      negativeMarksOverride: negativeMarksOverride === undefined ? undefined : negativeMarksOverride,
    },
  });
  return NextResponse.json(updated);
}
