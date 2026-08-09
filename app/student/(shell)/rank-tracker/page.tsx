import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";

function percentile(rank: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - rank / total) * 1000) / 10));
}

export default async function RankTrackerPage() {
  const session = getSession()!;
  const me = await prisma.user.findUnique({ where: { id: session.id } });

  const recentAttempts = await prisma.attempt.findMany({
    where: {
  studentId: session.id,
  testId: { not: null },
  status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
},
    orderBy: { submittedAt: "desc" },
    take: 10,
    include: { test: { select: { name: true } } },
  });

  if (recentAttempts.length === 0 || !me) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-ink mb-2">Rank Tracker</h1>
        <div className="card text-center text-ink-soft mt-6">
          Attempt and submit a test to start tracking your rank here.
        </div>
      </div>
    );
  }

  const latest = recentAttempts[0];

  // All submitted attempts on the SAME test, with each student's profile
  // fields, so we can compute state/institute/batch rank alongside the
  // overall (national) rank.
  const cohort = await prisma.attempt.findMany({
    where: { testId: latest.testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    orderBy: { score: "desc" },
    include: { student: { select: { id: true, state: true, city: true, institute: true, batch: true } } },
  });

  function rankWithin(filterFn: (s: (typeof cohort)[number]["student"]) => boolean) {
    const filtered = cohort.filter((a) => filterFn(a.student));
    const idx = filtered.findIndex((a) => a.studentId === session.id);
    return { rank: idx >= 0 ? idx + 1 : null, total: filtered.length };
  }

  const national = { rank: latest.rank, total: cohort.length };
  const stateGroup = me.state ? rankWithin((s) => s.state === me.state) : { rank: null, total: 0 };
  const instituteGroup = me.institute ? rankWithin((s) => s.institute === me.institute) : { rank: null, total: 0 };
  const batchGroup = me.batch ? rankWithin((s) => s.batch === me.batch) : { rank: null, total: 0 };

  // Rank trajectory across recent tests (oldest -> newest for the chart)
  const trajectory = [...recentAttempts].reverse().filter((a) => a.rank != null);
  const W = 800;
  const H = 220;
  const maxRank = Math.max(...trajectory.map((a) => a.rank || 1), 1);
  const coords = trajectory.map((a, i) => {
    const x = trajectory.length > 1 ? (i / (trajectory.length - 1)) * W : 0;
    // Lower rank number = better, so invert the y-axis (rank 1 near the top)
    const y = maxRank > 0 ? ((a.rank || maxRank) / maxRank) * (H - 20) : H;
    return { x, y, rank: a.rank, name: a.test?.name ?? "Test" };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="flex flex-col w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Rank Tracker</h1>
        <p className="text-ink-soft mt-2">
          Based on your most recent test: <span className="font-medium text-ink">{latest.test?.name ?? "Test"}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 card">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
                Rank (This Test)
              </h2>
              <div className="text-5xl font-bold text-brand">#{national.rank ?? "—"}</div>
              <div className="text-xs text-ink-soft mt-1">of {national.total} students</div>
            </div>
            {national.rank && national.total > 0 && (
              <span className="px-3 py-1 bg-brand-light text-brand rounded-full text-xs font-semibold">
                Top {(100 - percentile(national.rank, national.total)).toFixed(1) === "0.0" ? "1" : (100 - percentile(national.rank, national.total)).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-xl border-l-2 border-brand/40">
              <div className="text-xs text-ink-soft mb-1">State Rank</div>
              <div className="text-xl font-bold text-ink">{stateGroup.rank ? `#${stateGroup.rank}` : "—"}</div>
              {me.state && <div className="text-xs text-ink-soft mt-0.5">{me.state}</div>}
            </div>
            <div className="bg-surface p-4 rounded-xl border-l-2 border-purple-400">
              <div className="text-xs text-ink-soft mb-1">Institute Rank</div>
              <div className="text-xl font-bold text-ink">{instituteGroup.rank ? `#${instituteGroup.rank}` : "—"}</div>
              {me.institute && <div className="text-xs text-ink-soft mt-0.5 truncate">{me.institute}</div>}
            </div>
            <div className="bg-surface p-4 rounded-xl border-l-2 border-teal-400">
              <div className="text-xs text-ink-soft mb-1">Batch Rank</div>
              <div className="text-xl font-bold text-ink">{batchGroup.rank ? `#${batchGroup.rank}` : "—"}</div>
              {me.batch && <div className="text-xs text-ink-soft mt-0.5 truncate">{me.batch}</div>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 card flex flex-col">
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-4">Want a projection?</h2>
          <p className="text-sm text-ink-soft mb-4 flex-1">
            Enter your expected marks in the Rank Predictor to see an estimated All-India Rank based on
            previous-year trend data.
          </p>
          <Link href="/student/rank-predictor" className="btn-primary text-sm text-center">
            🎯 Open Rank Predictor
          </Link>
        </div>
      </div>

      {trajectory.length > 1 && (
        <div className="card">
          <h2 className="text-lg font-bold text-ink mb-1">Rank Trajectory</h2>
          <p className="text-xs text-ink-soft mb-6">Lower is better — line trending toward the top means you're climbing.</p>
          <div className="h-56 w-full relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
              <line x1="0" x2={W} y1={H - 20} y2={H - 20} stroke="#E1E3E4" strokeWidth="1" />
              <polyline points={polylinePoints} fill="none" stroke="#9D4400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="5" fill="white" stroke="#9D4400" strokeWidth="2" />
              ))}
            </svg>
          </div>
          <div className="flex justify-between text-xs text-ink-soft mt-2">
            {trajectory.map((a, i) => (
              <span key={i} className="truncate max-w-[80px]" title={a.test?.name ?? "Test"}>
                {a.rank ? `#${a.rank}` : "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold text-ink mb-4">Percentile Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "National", rank: national.rank, total: national.total },
            { label: "State", rank: stateGroup.rank, total: stateGroup.total },
            { label: "Institute", rank: instituteGroup.rank, total: instituteGroup.total },
          ].map((g) => (
            <div key={g.label} className="flex flex-col items-center p-4 bg-surface rounded-2xl">
              <div className="text-3xl font-bold text-brand mb-1">
                {g.rank && g.total ? `${percentile(g.rank, g.total).toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-ink-soft uppercase tracking-wider">{g.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
