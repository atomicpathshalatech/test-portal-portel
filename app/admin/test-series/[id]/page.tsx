import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isManagerTier, ownsOrManages } from "@/lib/permissions";
import TestActionsMenu from "@/components/TestActionsMenu";
import TestStatusActions from "@/components/TestStatusActions";

export default async function SeriesDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) redirect("/admin");

  const series = await prisma.testSeries.findUnique({
    where: { id: params.id },
    include: {
      tests: {
        orderBy: { createdAt: "desc" },
        include: { sections: { include: { questions: true } } },
      },
    },
  });
  if (!series) redirect("/admin/test-series");

  const totalQuestionsTarget = series.tests.reduce(
    (sum, t) => sum + t.sections.reduce((s, sec) => s + sec.targetCount, 0),
    0
  );
  const totalQuestionsAdded = series.tests.reduce(
    (sum, t) => sum + t.sections.reduce((s, sec) => s + sec.questions.length, 0),
    0
  );
  const publishedCount = series.tests.filter((t) => t.status === "PUBLISHED").length;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/test-series" className="text-sm text-brand mb-4 inline-block">
        ← All Test Series
      </Link>

      {/* Banner header */}
      <div className="card flex items-start gap-6 mb-6">
        {series.thumbnailUrl ? (
          <img src={series.thumbnailUrl} alt="" className="w-32 h-32 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-32 h-32 rounded-xl bg-brand-light flex items-center justify-center text-brand text-4xl flex-shrink-0">
            📚
          </div>
        )}
        <div className="flex-1">
          {series.examType && (
            <span className="text-xs font-semibold text-brand uppercase tracking-wide">{series.examType}</span>
          )}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{series.name}</h1>
            <Link href={`/admin/test-series/${series.id}/edit`} className="btn-secondary text-sm flex-shrink-0">
              Edit Series
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-1">Code: {series.code}</p>
          {series.description && <p className="text-sm text-slate-600 mt-3">{series.description}</p>}
          {series.tags && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {series.tags.split(",").map((t) => (
                <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {t.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand">{series.tests.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total Tests</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-success">{publishedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Published</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-slate-700">
            {totalQuestionsAdded}/{totalQuestionsTarget}
          </div>
          <div className="text-xs text-slate-500 mt-1">Questions Added</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Tests in this Series</h2>
        <Link href={`/admin/tests/builder?seriesId=${series.id}`} className="btn-primary text-sm">
          + Create Test
        </Link>
      </div>

      <div className="space-y-3">
        {series.tests.map((t) => {
          const target = t.sections.reduce((s, sec) => s + sec.targetCount, 0);
          const added = t.sections.reduce((s, sec) => s + sec.questions.length, 0);
          const questionsReady = target > 0 && added >= target;
          const canSubmit = ownsOrManages(session!.role, session!.id, t.createdById);
          return (
            <div key={t.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  📝
                </div>
                <div>
                  <div className="font-medium text-slate-800">{t.name}</div>
                  <div className="text-xs text-slate-400">
                    Code: {t.code} · {t.durationMin} min · {added}/{target} questions
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/tests/${t.id}/add-questions`} className="btn-secondary text-sm">
                  {added < target ? "Add Questions" : "Manage"}
                </Link>
                <TestStatusActions
                  testId={t.id}
                  status={t.status}
                  canSubmit={canSubmit}
                  canPublish={true}
                  questionsReady={questionsReady}
                />
                <TestActionsMenu
                  testId={t.id}
                  testName={t.name}
                  testCode={t.code}
                  archived={t.archived}
                  isDraft={t.status === "DRAFT"}
                  canManage={true}
                />
              </div>
            </div>
          );
        })}
        {series.tests.length === 0 && (
          <div className="card text-center text-slate-400">No tests in this series yet.</div>
        )}
      </div>
    </div>
  );
}
