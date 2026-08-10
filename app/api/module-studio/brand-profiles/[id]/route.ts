import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const profile = await prisma.brandProfile.update({
    where: { id: params.id },
    data: {
      name: body.name,
      logoUrl: body.logoUrl || null,
      primaryColor: body.primaryColor || null,
      secondaryColor: body.secondaryColor || null,
      fontFamily: body.fontFamily || null,
      websiteUrl: body.websiteUrl || null,
      tagline: body.tagline || null,
      headerConfig: body.headerConfig || {},
      footerConfig: body.footerConfig || {},
      watermarkConfig: body.watermarkConfig || {},
      isDefault: !!body.isDefault,
    },
  });

  return NextResponse.json({ profile });
}
