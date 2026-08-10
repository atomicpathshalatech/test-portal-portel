import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AnalyzePanel from "./AnalyzePanel";
import BrandingPanel from "./BrandingPanel";

export default async function ModuleDetailPage({ params }: { params: { id: string } }) {
  const mod = await prisma.module.findUnique({
    where: { id: params.id },
    include: {
      pages: { orderBy: { pageNumber: "asc" } },
      createdBy: { select: { name: true } },
    },
  });

  if (!mod) return notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">{mod.title}</h1>
        <span className="text-xs font-mono text-slate-400">{mod.code}</span>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        {[mod.subject, mod.class, mod.batch, mod.chapter].filter(Boolean).join(" · ") || "No metadata set"}
        {" · "}Uploaded by {mod.createdBy?.name || "—"}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Pages</p>
          <p className="text-2xl font-semibold text-slate-900">{mod.pageCount ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
          <p className="text-2xl font-semibold text-slate-900">{mod.status.replace("_", " ")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide">PDF Type</p>
          <p className="text-2xl font-semibold text-slate-900">{mod.pdfType}</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Link href={`/admin/module-studio/${mod.id}/review`} className="btn-secondary">
          Go to Review →
        </Link>
      </div>

      <BrandingPanel moduleId={mod.id} currentBrandProfileId={mod.brandProfileId} />

      <AnalyzePanel
        moduleId={mod.id}
        status={mod.status}
        pages={mod.pages.map((p) => ({
          pageNumber: p.pageNumber,
          width: p.width,
          height: p.height,
          pdfType: p.pdfType,
          referenceImageUrl: p.referenceImageUrl,
          needsReview: p.needsReview,
          elementCount: Array.isArray(p.elements) ? p.elements.length : 0,
          warnings: (p.warnings as any) || [],
        }))}
      />

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
        <p className="font-medium mb-1 text-slate-700">Visual editor not yet built</p>
        <p>
          Extracted elements are stored per page but there's no interactive canvas to view or
          edit them yet, and no branding/export tools. Those are the next phases.
        </p>
      </div>
    </div>
  );
}
