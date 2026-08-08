import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Only Sub Admin / Super Admin can delete templates" }, { status: 401 });
  }
  await prisma.testTemplateSection.deleteMany({ where: { templateId: params.id } });
  await prisma.testTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
