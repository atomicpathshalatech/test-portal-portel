import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isManagerTier, ownsOrManages } from "@/lib/permissions";
import TestStatusActions from "@/components/TestStatusActions";
import TestActionsMenu from "@/components/TestActionsMenu";

export default async function AdminTestsPage({ searchParams }: { searchParams: { archived?: string } }) {
  const session = getSession()!;
  const manager = isManagerTier(session.role);
  const showArchived = searchParams.archived === "1";

  // Rule 3 / ownership: a Teacher only manages their own tests here;
  // Sub Admin / Super Admin see everything.
  const tests = await prisma.test.findMany({
    where: {
      ...(manager ? {} : { createdById: session.id }),
      archived: showArchived,
    },
    orderBy: { createdAt: "desc" },
    include: {
      testSeries: { select: { name: true } },
      createdBy: { select: { name: true } },
      sections: { select: { targetCount: true, questions: { select: { id: true } } } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">Manage Tests</h1>
        <Link
          href={showArchived ? "/admin/tests" : "/admin/tests?archived=1"}
          className="text-xs text-slate-400 underline"
        >
          {showArchived ? "← Back to active tests" : "View archived tests"}
        </Link>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        {manager
          ? "All tests across the platform. Approve/publish drafts submitted by teachers, or publish directly."
          : "Your tests. Submit a draft for approval once it's ready — a Sub Admin or Super Admin will publish it."}{" "}
        Once published, download the Question Paper / Solution PDF or the Rank List report.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4">Test</th>
              <th className="py-2 pr-4">Series</th>
              <th className="py-2 pr-4">Created By</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Download</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const isBoth = t.languageMode === "BOTH";
              const isEn = t.languageMode === "ENGLISH";
              const isHi = t.languageMode === "HINDI";
              const canSubmit = ownsOrManages(session.role, session.id, t.createdById);
              const totalTarget = t.sections.reduce((s, sec) => s + sec.targetCount, 0);
              const totalAdded = t.sections.reduce((s, sec) => s + sec.questions.length, 0);
              const questionsReady = totalTarget > 0 && totalAdded >= totalTarget;
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-slate-800">{t.name}</div>
                    <div className="text-xs text-slate-400">Code: {t.code}</div>
                    <Link href={`/admin/tests/${t.id}/add-questions`} className="text-xs text-brand underline">
                      Add Questions → ({totalAdded}/{totalTarget})
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{t.testSeries.name}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{t.createdBy?.name || "—"}</td>
                  <td className="py-2 pr-4">
                    <TestStatusActions
                      testId={t.id}
                      status={t.status}
                      canSubmit={canSubmit}
                      canPublish={manager}
                      questionsReady={questionsReady}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    {t.status !== "PUBLISHED" ? (
                      <span className="text-xs text-slate-400">Publish first to export</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {isBoth && (
                          <>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=question`} className="text-xs text-brand underline">
                              Question (HI+EN)
                            </a>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=solution`} className="text-xs text-success underline">
                              Solution (HI+EN)
                            </a>
                          </>
                        )}
                        {isEn && (
                          <>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=question&lang=en`} className="text-xs text-brand underline">
                              Question
                            </a>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=solution&lang=en`} className="text-xs text-success underline">
                              Solution
                            </a>
                          </>
                        )}
                        {isHi && (
                          <>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=question&lang=hi`} className="text-xs text-brand underline">
                              Question
                            </a>
                            <a href={`/api/tests/${t.id}/export-pdf?mode=solution&lang=hi`} className="text-xs text-success underline">
                              Solution
                            </a>
                          </>
                        )}
                        <span className="text-slate-300">|</span>
                        <a href={`/api/tests/${t.id}/export-report?format=xlsx`} className="text-xs text-orange-600 underline">
                          Report (Excel)
                        </a>
                        <a href={`/api/tests/${t.id}/export-report?format=csv`} className="text-xs text-orange-600 underline">
                          Report (CSV)
                        </a>
                        <span className="text-slate-300">|</span>
                        <Link href={`/admin/tests/${t.id}/review`} className="text-xs text-purple-600 underline">
                          Post-Test Corrections
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <TestActionsMenu
                      testId={t.id}
                      testName={t.name}
                      testCode={t.code}
                      archived={t.archived}
                      isDraft={t.status === "DRAFT"}
                      canManage={manager}
                    />
                  </td>
                </tr>
              );
            })}
            {tests.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  {showArchived ? "No archived tests." : "No tests yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
