import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function ResultsHistoryPage() {
  const session = getSession()!;

  const attempts = await prisma.attempt.findMany({
    where: {
  studentId: session.id,
  testId: { not: null },
  status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
},
    include: { test: { include: { sections: { include: { questions: true } } } } },
    orderBy: { submittedAt: "asc" }, // ascending for the trend chart, we'll reverse for the table
  });

  const points = attempts
  .map((a) => {
    if (!a.test) return null;

    const questionCount = a.test.sections.reduce(
      (s, sec) => s + sec.questions.length,
      0
    );

    const maxMarks = questionCount * a.test.correctMarks;
    const pct = maxMarks > 0 ? ((a.score || 0) / maxMarks) * 100 : 0;

    return {
      pct,
      score: a.score ?? 0,
      name: a.test.name,
      date: a.submittedAt,
    };
  })
  .filter((p): p is NonNullable<typeof p> => p !== null);

  const avgPct = points.length > 0 ? points.reduce((s, p) => s + p.pct, 0) / points.length : 0;
  const bestPct = points.length > 0 ? Math.max(...points.map((p) => p.pct)) : 0;

  // Peak score (raw marks) + which test it was
  let peak = points[0];
  for (const p of points) if (p.score > (peak?.score ?? -Infinity)) peak = p;

  // Average rank across attempts that have one
  const ranked = attempts.filter((a) => a.rank != null);
  const avgRank = ranked.length > 0 ? Math.round(ranked.reduce((s, a) => s + (a.rank || 0), 0) / ranked.length) : null;

  // Most improved: biggest score jump between consecutive attempts
  let mostImproved: { delta: number; name: string } | null = null;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].score - points[i - 1].score;
    if (!mostImproved || delta > mostImproved.delta) mostImproved = { delta, name: points[i].name };
  }

  // Growth trend: compare first-half average to second-half average
  const half = Math.floor(points.length / 2);
  const trendUp =
    points.length >= 2 &&
    points.slice(half).reduce((s, p) => s + p.pct, 0) / (points.length - half) >=
      points.slice(0, half).reduce((s, p) => s + p.pct, 0) / Math.max(half, 1);

  // Build a simple SVG sparkline from real percentage points (no chart library needed)
  const W = 1000;
  const H = 200;
  const coords =
    points.length > 1
      ? points.map((p, i) => {
          const x = (i / (points.length - 1)) * W;
          const y = H - (p.pct / 100) * H;
          return { x, y };
        })
      : [];
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath =
    coords.length > 0
      ? `M0,${H} L${coords.map((c) => `${c.x},${c.y}`).join(" L")} L${W},${H} Z`
      : "";

  const rows = [...attempts].reverse(); // most recent first for the table
  const scoreDeltaByAttemptId = new Map<string, number>();
  for (let i = 1; i < attempts.length; i++) {
    scoreDeltaByAttemptId.set(attempts[i].id, (attempts[i].score ?? 0) - (attempts[i - 1].score ?? 0));
  }

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex items-end justify-between w-full">
        <div>
          <h1 className="text-3xl font-bold text-ink">Results History</h1>
          <p className="text-ink-soft mt-2">Track your progress across every test you've taken.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Peak Score</span>
            <span className="material-symbols-outlined text-brand text-xl">military_tech</span>
          </div>
          <div className="text-3xl font-bold text-ink">{peak?.score ?? "—"}</div>
          {peak && <div className="text-xs text-ink-soft mt-1 truncate">{peak.name}</div>}
        </div>
        <div className="card">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Avg. Rank</span>
            <span className="material-symbols-outlined text-brand text-xl">format_list_numbered</span>
          </div>
          <div className="text-3xl font-bold text-ink">{avgRank ?? "—"}</div>
          <div className="text-xs text-ink-soft mt-1">across {ranked.length} ranked test(s)</div>
        </div>
        <div className="card">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Most Improved</span>
            <span className="material-symbols-outlined text-success text-xl">speed</span>
          </div>
          <div className="text-3xl font-bold text-success">
            {mostImproved ? `${mostImproved.delta >= 0 ? "+" : ""}${mostImproved.delta}` : "—"}
          </div>
          {mostImproved && <div className="text-xs text-ink-soft mt-1 truncate">{mostImproved.name}</div>}
        </div>
        <div className="card">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Average Score</span>
            <span className="material-symbols-outlined text-brand text-xl">monitoring</span>
          </div>
          <div className="text-3xl font-bold text-ink">{avgPct.toFixed(1)}%</div>
          {points.length >= 2 && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? "text-success" : "text-danger"}`}>
              <span className="material-symbols-outlined text-sm">{trendUp ? "arrow_upward" : "arrow_downward"}</span>
              {trendUp ? "Trending up" : "Trending down"}
            </div>
          )}
        </div>
      </div>

      {points.length > 1 && (
        <div className="card">
          <h2 className="text-lg font-bold text-ink mb-6">Score Trend</h2>
          <div className="h-48 w-full relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
              <line x1="0" x2={W} y1={H} y2={H} stroke="#E1E3E4" strokeWidth="1" />
              <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#E1E3E4" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" x2={W} y1="0" y2="0" stroke="#E1E3E4" strokeWidth="1" strokeDasharray="4 4" />
              <path d={areaPath} fill="#9D4400" opacity="0.08" />
              <polyline points={polylinePoints} fill="none" stroke="#9D4400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="5" fill="white" stroke="#9D4400" strokeWidth="2" />
              ))}
            </svg>
            <div className="absolute -left-8 top-0 h-full flex flex-col justify-between text-right text-xs text-ink-soft pointer-events-none">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-lowest rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 bg-surface-container">
          <h3 className="font-bold text-ink">Attempt Log</h3>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-highest text-ink-soft text-xs uppercase tracking-wide">
                <th className="p-4">Date</th>
                <th className="p-4">Test Name</th>
                <th className="p-4 text-right">Score</th>
                <th className="p-4 text-right">Rank</th>
                <th className="p-4 text-right">Change</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highest/60">
              {rows.map((a) => {
                const delta = scoreDeltaByAttemptId.get(a.id);
                return (
                  <tr key={a.id} className="hover:bg-surface-container/40 transition-colors">
                    <td className="p-4 text-sm text-ink-soft">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-4 text-sm font-medium text-ink">
  {a.test?.name ?? "DPP Attempt"}
</td>
                    <td className="p-4 text-right text-sm font-semibold">{a.score ?? "—"}</td>
                    <td className="p-4 text-right text-sm text-ink-soft">{a.rank ?? "—"}</td>
                    <td className="p-4 text-right">
                      {delta !== undefined ? (
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            delta >= 0 ? "bg-green-50 text-success" : "bg-red-50 text-danger"
                          }`}
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta} pts
                        </span>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/student/result/${a.id}`} className="text-brand text-sm font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink-soft">
                    No results yet — attempt a test to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
