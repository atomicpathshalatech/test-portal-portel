import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildBrandingElements, stripBrandingElements } from "@/lib/moduleBranding";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.brandProfileId) {
    return NextResponse.json({ message: "brandProfileId is required" }, { status: 400 });
  }

  const [mod, brandProfile] = await Promise.all([
    prisma.module.findUnique({ where: { id: params.id }, include: { pages: true } }),
    prisma.brandProfile.findUnique({ where: { id: body.brandProfileId } }),
  ]);
  if (!mod) return NextResponse.json({ message: "Module not found" }, { status: 404 });
  if (!brandProfile) return NextResponse.json({ message: "Brand profile not found" }, { status: 404 });

  for (const page of mod.pages) {
    const withoutOldBranding = stripBrandingElements((page.elements as any) || []);
    const brandingElements = buildBrandingElements({
      headerConfig: brandProfile.headerConfig as any,
      footerConfig: brandProfile.footerConfig as any,
      watermarkConfig: brandProfile.watermarkConfig as any,
      pageWidth: page.width,
      pageHeight: page.height,
      pageNumber: page.pageNumber,
      moduleSubject: mod.subject,
      moduleClass: mod.class,
    });

    await prisma.modulePage.update({
      where: { id: page.id },
      data: { elements: [...withoutOldBranding, ...brandingElements] as any },
    });
  }

  const updated = await prisma.module.update({
    where: { id: mod.id },
    data: { brandProfileId: brandProfile.id },
  });

  return NextResponse.json({ module: updated });
}
