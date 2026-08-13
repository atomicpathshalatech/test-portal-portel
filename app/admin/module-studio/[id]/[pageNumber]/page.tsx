import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageCanvas from "./PageCanvas";

export default async function PageEditorRoute({
  params,
}: {
  params: { id: string; pageNumber: string };
}) {
  const pageNumber = parseInt(params.pageNumber, 10);
  const [mod, page] = await Promise.all([
    prisma.module.findUnique({ where: { id: params.id }, select: { id: true, title: true, pageCount: true } }),
    prisma.modulePage.findUnique({
      where: { moduleId_pageNumber: { moduleId: params.id, pageNumber } },
    }),
  ]);

  if (!mod || !page) return notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href={`/admin/module-studio/${mod.id}`} className="text-sm text-indigo-600 hover:underline transition-all duration-150">
            ← {mod.title}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Page {pageNumber}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          {pageNumber > 1 && (
            <Link href={`/admin/module-studio/${mod.id}/${pageNumber - 1}`} className="btn-secondary">
              ← Prev
            </Link>
          )}
          {mod.pageCount && pageNumber < mod.pageCount && (
            <Link href={`/admin/module-studio/${mod.id}/${pageNumber + 1}`} className="btn-secondary">
              Next →
            </Link>
          )}
        </div>
      </div>

      <PageCanvas
        moduleId={mod.id}
        pageNumber={pageNumber}
        pageWidth={page.width}
        pageHeight={page.height}
        initialElements={(page.elements as any) || []}
        initialNeedsReview={page.needsReview}
      />
    </div>
  );
}
