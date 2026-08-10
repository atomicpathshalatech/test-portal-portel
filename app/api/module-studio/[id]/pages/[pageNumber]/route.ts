import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; pageNumber: string } }
) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const page = await prisma.modulePage.findUnique({
    where: {
      moduleId_pageNumber: { moduleId: params.id, pageNumber: parseInt(params.pageNumber, 10) },
    },
  });
  if (!page) {
    return NextResponse.json({ message: "Page not found" }, { status: 404 });
  }
  return NextResponse.json({ page });
}

// Full-array replace, not a diff/patch of individual elements. Simpler and
// safer for this first editor slice — the client always sends its complete
// current element list back. Real per-element undo/redo (spec §37) would
// need an operation log instead of this; not built yet, noted in the setup doc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; pageNumber: string } }
) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!Array.isArray(body.elements)) {
    return NextResponse.json({ message: "elements must be an array" }, { status: 400 });
  }

  // Minimal shape validation — reject anything missing the fields the
  // canvas depends on rather than silently persisting a malformed element.
  for (const el of body.elements) {
    if (
      typeof el.id !== "string" ||
      typeof el.type !== "string" ||
      typeof el.x !== "number" ||
      typeof el.y !== "number" ||
      typeof el.width !== "number" ||
      typeof el.height !== "number"
    ) {
      return NextResponse.json({ message: `Malformed element: ${JSON.stringify(el).slice(0, 100)}` }, { status: 400 });
    }
  }

  const pageNumber = parseInt(params.pageNumber, 10);
  const existing = await prisma.modulePage.findUnique({
    where: { moduleId_pageNumber: { moduleId: params.id, pageNumber } },
  });
  if (!existing) {
    return NextResponse.json({ message: "Page not found" }, { status: 404 });
  }

  const updated = await prisma.modulePage.update({
    where: { id: existing.id },
    data: {
      elements: body.elements,
      // A manual edit is a human confirming/correcting the page — clear the
      // review flag unless the client explicitly says otherwise, since the
      // whole point of the editor is to resolve what analysis/extraction flagged.
      needsReview: body.needsReview ?? false,
    },
  });

  return NextResponse.json({ page: updated });
}
