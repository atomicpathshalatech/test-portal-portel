import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";

export default async function TestSeriesListPage() {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) redirect("/admin");

  const series = await prisma.testSeries.findMany({
    orderBy: { createdAt: "desc" },
    include: { tests: true },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Test Series</h1>
        <Link href="/admin/test-series/new" className="btn-primary text-sm px-3 sm:px-5">
          + New Series
        </Link>
      </div>

      {series.length === 0 ? (
        <div className="card text-center text-slate-500">
          No test series yet. Create your first one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/admin/test-series/${s.id}`}
              className="card flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              {s.thumbnailUrl ? (
                <img src={s.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-brand-light flex items-center justify-center text-brand text-xl flex-shrink-0">
                  📚
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{s.name}</div>
                <div className="text-sm text-slate-500">
                  Code: {s.code} · {s.tests.length} test(s) {s.examType ? `· ${s.examType}` : ""}
                </div>
              </div>
              <span className="text-brand text-sm font-medium">View Series →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
