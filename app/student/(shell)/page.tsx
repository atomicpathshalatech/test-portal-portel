import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";

function ProgressRing({ value, color = "text-brand" }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-20 h-20 relative flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-surface-high"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className={color}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${clamped}, 100`}
          strokeLinecap="round"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <span className="absolute text-lg font-bold text-ink">{Math.round(clamped)}%</span>
    </div>
  );
}

export default async function StudentDashboard() {
  const session = getSession()!;
  const now = new Date();

  const [allTests, myAttempts] = await Promise.all([
    prisma.test.findMany({ where: { status: "PUBLISHED" }, orderBy: { openTime: "asc" }, include: { testSeries: true, sections: { include: { questions: true } } } }),
    prisma.attempt.findMany({
      where: { studentId: session.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, testId: { not: null } },
      include: { test: { include: { sections: { include: { questions: true } } } }, answers: true },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const nextTest = allTests.find((t) => t.closeTime > now);
  const isNextLive = nextTest ? now >= nextTest.openTime && now <= nextTest.closeTime : false;

  // Performance overview from real submitted attempts
  let avgPercentage = 0;
  if (myAttempts.length > 0) {
    const percentages = myAttempts
      .filter((a) => a.test)
      .map((a) => {
        const test = allTests.find((t) => t.id === a.testId) || a.test!;
        const questionCount = test.sections?.reduce((s: number, sec: any) => s + sec.questions.length, 0) || 0;
        const maxMarks = questionCount * test.correctMarks;
        return maxMarks > 0 ? ((a.score || 0) / maxMarks) * 100 : 0;
    });
    avgPercentage = percentages.reduce((s, p) => s + p, 0) / percentages.length;
  }

  let totalCorrect = 0;
  let totalAttempted = 0;
  for (const a of myAttempts) {
    for (const ans of a.answers) {
      const selected = Array.isArray(ans.selectedOptionIds) ? (ans.selectedOptionIds as any[]) : [];
      if (selected.length === 0) continue;
      totalAttempted++;
      if (ans.isCorrect) totalCorrect++;
    }
  }
  const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

  const upcomingOrLive = allTests.filter((t) => t.closeTime > now).slice(0, 3);

  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <div className="mb-8 p-8 rounded-3xl bg-gradient-to-br from-brand-light to-brand-container/10 relative overflow-hidden shadow-sm">
        <div className="absolute -right-16 -top-16 w-72 h-72 bg-brand opacity-10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-ink mb-2">
            {now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"}, {session.name.split(" ")[0]}!
          </h1>
          {nextTest ? (
            <p className="text-ink-soft max-w-xl">
              {isNextLive ? "Your test is live now — " : "Your next test: "}
              <strong className="text-ink">{nextTest.name}</strong>
            </p>
          ) : (
            <p className="text-ink-soft">No upcoming tests scheduled right now.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Next test hero card */}
          {nextTest && (
            <div className="card relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-light text-brand">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isNextLive ? "Live Now" : `Opens ${nextTest.openTime.toLocaleDateString()}`}
                  </span>
                </div>
                <span className="text-xs text-ink-soft bg-surface-container px-3 py-1 rounded-md">
                  Duration: {nextTest.durationMin} min
                </span>
              </div>
              <h2 className="text-xl font-bold text-ink mb-2">{nextTest.name}</h2>
              <p className="text-ink-soft text-sm mb-6">{nextTest.testSeries.name}</p>
              {isNextLive ? (
                <Link href={`/student/exam/${nextTest.id}`} className="btn-primary inline-flex items-center gap-2">
                  Start Now <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              ) : (
                <span className="btn-secondary inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
                  Not open yet
                </span>
              )}
            </div>
          )}

          {/* Performance overview */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink">Performance Overview</h3>
              <Link href="/student/results" className="text-sm text-brand font-medium flex items-center gap-1">
                Full History <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card flex flex-col items-center text-center">
                <ProgressRing value={avgPercentage} />
                <p className="font-semibold text-ink mt-3">Avg. Score</p>
              </div>
              <div className="card flex flex-col items-center text-center">
                <ProgressRing value={accuracy} color="text-success" />
                <p className="font-semibold text-ink mt-3">Accuracy</p>
              </div>
              <div className="card flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-surface-high rounded-full flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <p className="text-3xl font-bold text-ink leading-none mb-1">{myAttempts.length}</p>
                <p className="text-sm text-ink-soft">Tests Completed</p>
              </div>
            </div>
          </div>

          {/* Test list — grouped by series */}
          <div>
            <h3 className="text-lg font-bold text-ink mb-4">My Tests</h3>
            <div className="flex flex-col gap-6">
              {Object.entries(
                allTests.reduce((groups, t) => {
                  const key = t.testSeries.id;
                  if (!groups[key]) groups[key] = { series: t.testSeries, tests: [] as typeof allTests };
                  groups[key].tests.push(t);
                  return groups;
                }, {} as Record<string, { series: (typeof allTests)[number]["testSeries"]; tests: typeof allTests }>)
              ).map(([seriesId, group]) => (
                <div key={seriesId}>
                  <Link
                    href={`/student/series/${seriesId}`}
                    className="flex items-center gap-2 mb-2 text-sm font-semibold text-ink hover:text-brand"
                  >
                    📚 {group.series.name}
                    <span className="text-xs text-ink-soft font-normal">({group.tests.length}) →</span>
                  </Link>
                  <div className="flex flex-col gap-3">
                    {group.tests.map((t) => {
                      const isLive = now >= t.openTime && now <= t.closeTime;
                      const isCompleted = now > t.closeTime;
                      return (
                        <div key={t.id} className="card flex items-center justify-between py-4">
                          <div>
                            <div className="font-semibold text-ink">{t.name}</div>
                            <div className="text-xs text-ink-soft">
                              {t.durationMin} min · {t.languageMode}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isLive && <Link href={`/student/exam/${t.id}`} className="btn-primary text-sm">Start</Link>}
                            {isCompleted && (
                              <>
                                <Link href={`/student/result/by-test/${t.id}`} className="btn-secondary text-sm">Result</Link>
                                <Link href={`/student/leaderboard/${t.id}`} className="btn-secondary text-sm">Leaderboard</Link>
                              </>
                            )}
                            {!isLive && !isCompleted && (
                              <span className="text-xs text-ink-soft bg-surface-container px-3 py-1.5 rounded-full">Upcoming</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {allTests.length === 0 && (
                <div className="card text-center text-ink-soft">No tests scheduled yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="bg-surface-highest rounded-3xl p-6">
            <h3 className="font-bold text-ink mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand">bolt</span> Quick Access
            </h3>
            <div className="space-y-3">
              {[
                { href: "/student/rank-tracker", icon: "trophy", label: "Rank Tracker", sub: "AIR, state & institute rank" },
                { href: "/student/ai-coach", icon: "psychology", label: "AI Coach", sub: "Weak/strong topics" },
                { href: "/student/rank-predictor", icon: "target", label: "Rank Predictor", sub: "Estimate your rank" },
                { href: "/student/schedule", icon: "calendar_month", label: "Schedule", sub: "Upcoming tests" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface-lowest hover:bg-surface hover:shadow-md transition-all duration-150 shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center text-brand">
                    <span className="material-symbols-outlined">{link.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-ink">{link.label}</p>
                    <p className="text-xs text-ink-soft">{link.sub}</p>
                  </div>
                  <span className="material-symbols-outlined text-ink-soft opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    arrow_forward
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-ink mb-6">Recent Activity</h3>
            <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-2 before:w-[2px] before:bg-surface-high">
              {myAttempts.slice(0, 4).map((a) => (
                <div key={a.id} className="relative">
                  <div className="absolute -left-[26px] top-1 w-3.5 h-3.5 rounded-full bg-brand ring-4 ring-surface-lowest" />
                  <p className="text-xs text-brand mb-1 uppercase tracking-wide">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : ""}
                  </p>
                  <Link
                    href={`/student/result/${a.id}`}
                    className="block p-3 rounded-xl bg-surface hover:bg-surface-container transition-colors duration-150 border border-surface-highest/40"
                  >
                    <p className="text-sm font-semibold text-ink mb-0.5">{a.test?.name || "—"}</p>
                    <p className="text-xs text-ink-soft">Score: {a.score ?? "—"}</p>
                  </Link>
                </div>
              ))}
              {myAttempts.length === 0 && (
                <p className="text-sm text-ink-soft">No activity yet — attempt a test to see it here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
