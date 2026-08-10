import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const profiles = await prisma.brandProfile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ message: "Name is required" }, { status: 400 });
  }

  const profile = await prisma.brandProfile.create({
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
      createdById: session.id,
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
