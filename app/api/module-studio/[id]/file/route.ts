import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getSupabaseAdmin,
  MODULE_ORIGINALS_BUCKET,
  MODULE_ASSETS_BUCKET,
} from "@/lib/supabaseAdmin";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // short-lived — re-requested each time the page needs it

// GET /api/module-studio/[id]/file?page=3        -> signed URL for that page's reference image
// GET /api/module-studio/[id]/file?asset=<path>   -> signed URL for an extracted image element
// GET /api/module-studio/[id]/file                -> signed URL for the original PDF
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const pageParam = req.nextUrl.searchParams.get("page");
  const assetParam = req.nextUrl.searchParams.get("asset");
  const supabase = getSupabaseAdmin();

  if (assetParam) {
    // Extracted-image elements store their own storage path as assetId.
    // Guard against path traversal / cross-module access by requiring the
    // path to actually belong to this module.
    if (!assetParam.startsWith(`${params.id}/`)) {
      return NextResponse.json({ message: "Invalid asset path" }, { status: 400 });
    }
    const { data, error } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .createSignedUrl(assetParam, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      return NextResponse.json({ message: error?.message || "Could not sign URL" }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl });
  }

  if (pageParam) {
    const pageNumber = parseInt(pageParam, 10);
    const page = await prisma.modulePage.findUnique({
      where: { moduleId_pageNumber: { moduleId: params.id, pageNumber } },
    });
    if (!page?.referenceImageUrl) {
      return NextResponse.json({ message: "Reference image not available — run analysis first" }, { status: 404 });
    }
    const { data, error } = await supabase.storage
      .from(MODULE_ASSETS_BUCKET)
      .createSignedUrl(page.referenceImageUrl, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      return NextResponse.json({ message: error?.message || "Could not sign URL" }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl });
  }

  const mod = await prisma.module.findUnique({ where: { id: params.id } });
  if (!mod) {
    return NextResponse.json({ message: "Module not found" }, { status: 404 });
  }
  const { data, error } = await supabase.storage
    .from(MODULE_ORIGINALS_BUCKET)
    .createSignedUrl(mod.originalFileUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return NextResponse.json({ message: error?.message || "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
