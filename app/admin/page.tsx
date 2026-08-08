import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import Link from "next/link";

const ICON_STYLE: Record<string, { icon: string; bg: string; text: string }> = {
  "Test Series": { icon: "layers", bg: "bg-orange-100", text: "text-orange-600" },
  Tests: { icon: "description", bg: "bg-blue-100", text: "text-blue-600" },
  Questions: { icon: "quiz", bg: "bg-green-100", text: "text-green-600" },
  Students: { icon: "groups", bg: "bg-purple-100", text: "text-purple-600" },
  "Live Attempts": { icon: "podcasts", bg: "bg-pink-100", text: "text-pink-600" },
  "Pending Approval": { icon: "hourglass_top", bg: "bg-amber-100", text: "text-amber-600" },
  "Suspicious Sessions": { icon: "shield", bg: "bg-red-100", text: "text-red-600" },
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-purple-100 text-purple-700",
  PUBLISHED: "bg-green-100 text-green-700",
};

function fmtDelta(pct: number) {
  const sign = pct >= 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(pct).toFixed(0)}%`;
}

export default async function AdminDashboard() {
  const session = getSession()!;
  const manager = isManagerTier(session.role);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const questionWhere = session.role === "TEACHER" && session.subject ? { subject: session.subject } : undefined;

  const [seriesCount, testCount, questionCount, studentCount, liveAttempts, suspiciousCount, pendingApproval] =
    await Promise.all([
      prisma.testSeries.count(),
      prisma.test.count(),
      prisma.question.count({ where: questionWhere }),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.attempt.count({ where: { status: "IN_PROGRESS" } }),
      prisma.attempt.count({ where: { integrityScore: { lt: 70 } } }),
      prisma.test.count({ where: { status: { in: ["PENDING_APPROVAL", "UNDER_REVIEW"] } } }),
    ]);

  const stats = manager
    ? [
        { label: "Test Series", value: seriesCount },
        { label: "Tests", value: testCount },
        { label: "Questions", value: questionCount },
        { label: "Students", value: studentCount },
        { label: "Live Attempts", value: liveAttempts },
        { label: "Pending Approval", value: pendingApproval },
        { label: "Suspicious Sessions", value: suspiciousCount },
      ]
    : [
        { label: "Questions", value: questionCount },
        { label: "Tests", value: testCount },
        { label: "Live Attempts", value: liveAttempts },
      ];

  // ----- Manager-only rich analytics (Performance Overview, Test Activity, etc.) -----
  let performance = null as null | {
    totalAttempts: number;
    totalAttemptsPrev: number;
    avgScorePct: number;
    avgScorePctPrev: number;
    avgAccuracyPct: number;
    avgAccuracyPctPrev: number;
    avgTimeMin: number;
    avgTimeMinPrev: number;
    weeklyTrend: { label: string; avgPct: number }[];
    completed: number;
    inProgress: number;
    notAttempted: number;
    topStudents: { name: string; avgPct: number; testsCount: number }[];
    recentTests: { id: string; name: string; seriesName: string; status: string; attemptCount: number }[];
    totalUsers: number;
    activeUsers30d: number;
  };

  if (manager) {
    const recentAttempts = await prisma.attempt.findMany({
      where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, submittedAt: { gte: sixtyDaysAgo } },
      include: { test: { include: { sections: { include: { questions: true } } } }, student: { select: { name: true } } },
    });

    function analyze(attempts: typeof recentAttempts) {
      if (attempts.length === 0) return { avgPct: 0, avgTimeMin: 0 };
      let pctSum = 0;
      let timeSum = 0;
      let timeCount = 0;
      for (const a of attempts) {
        const qCount = a.test.sections.reduce((s, sec) => s + sec.questions.length, 0);
        const maxMarks = qCount * a.test.correctMarks;
        pctSum += maxMarks > 0 ? ((a.score || 0) / maxMarks) * 100 : 0;
        if (a.submittedAt) {
          timeSum += (a.submittedAt.getTime() - a.startedAt.getTime()) / 60000;
          timeCount++;
        }
      }
      return { avgPct: pctSum / attempts.length, avgTimeMin: timeCount > 0 ? timeSum / timeCount : 0 };
    }

    const last30 = recentAttempts.filter((a) => a.submittedAt && a.submittedAt >= thirtyDaysAgo);
    const prev30 = recentAttempts.filter((a) => a.submittedAt && a.submittedAt < thirtyDaysAgo);
    const cur = analyze(last30);
    const prev = analyze(prev30);

    // Accuracy: correct / (correct+incorrect) across answers of last-30-day attempts
    const last30Ids = last30.map((a) => a.id);
    const answers = last30Ids.length
      ? await prisma.attemptAnswer.findMany({ where: { attemptId: { in: last30Ids } } })
      : [];
    let correct = 0;
    let attempted = 0;
    for (const ans of answers) {
      const sel = Array.isArray(ans.selectedOptionIds) ? (ans.selectedOptionIds as any[]) : [];
      if (sel.length === 0) continue;
      attempted++;
      if (ans.isCorrect) correct++;
    }
    const avgAccuracyPct = attempted > 0 ? (correct / attempted) * 100 : 0;

    // Weekly trend — bucket last30 attempts into ~5 weekly buckets
    const buckets: { label: string; scores: number[] }[] = [];
    for (let i = 4; i >= 0; i--) {
      const bucketEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      buckets.push({ label: bucketEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" }), scores: [] });
    }
    for (const a of last30) {
      if (!a.submittedAt) continue;
      const daysAgo = Math.floor((now.getTime() - a.submittedAt.getTime()) / (24 * 60 * 60 * 1000));
      const bucketIdx = Math.min(4, Math.floor(daysAgo / 7));
      const qCount = a.test.sections.reduce((s, sec) => s + sec.questions.length, 0);
      const maxMarks = qCount * a.test.correctMarks;
      const pct = maxMarks > 0 ? ((a.score || 0) / maxMarks) * 100 : 0;
      buckets[4 - bucketIdx].scores.push(pct);
    }
    const weeklyTrend = buckets.map((b) => ({
      label: b.label,
      avgPct: b.scores.length > 0 ? b.scores.reduce((s, v) => s + v, 0) / b.scores.length : 0,
    }));

    const inProgressCount = await prisma.attempt.count({ where: { status: "IN_PROGRESS" } });
    const studentsWithAnyAttempt = await prisma.attempt.findMany({
      select: { studentId: true },
      distinct: ["studentId"],
    });
    const notAttempted = Math.max(0, studentCount - studentsWithAnyAttempt.length);

    // Top performing students — by average score % across their submitted attempts
    const allSubmitted = await prisma.attempt.findMany({
      where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      include: { test: { include: { sections: { include: { questions: true } } } }, student: { select: { name: true } } },
    });
    const byStudent = new Map<string, { name: string; pcts: number[] }>();
    for (const a of allSubmitted) {
      const qCount = a.test.sections.reduce((s, sec) => s + sec.questions.length, 0);
      const maxMarks = qCount * a.test.correctMarks;
      const pct = maxMarks > 0 ? ((a.score || 0) / maxMarks) * 100 : 0;
      const entry = byStudent.get(a.studentId) || { name: a.student.name, pcts: [] };
      entry.pcts.push(pct);
      byStudent.set(a.studentId, entry);
    }
    const topStudents = Array.from(byStudent.values())
      .map((s) => ({ name: s.name, avgPct: s.pcts.reduce((x, y) => x + y, 0) / s.pcts.length, testsCount: s.pcts.length }))
      .sort((a, b) => b.avgPct - a.avgPct)
      .slice(0, 5);

    const recentTestsRaw = await prisma.test.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { testSeries: { select: { name: true } }, attempts: { select: { id: true } } },
    });
    const recentTests = recentTestsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      seriesName: t.testSeries.name,
      status: t.status,
      attemptCount: t.attempts.length,
    }));

    const totalUsers = await prisma.user.count();
    const activeUserSessions = await prisma.deviceSession.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    });

    performance = {
      totalAttempts: last30.length,
      totalAttemptsPrev: prev30.length,
      avgScorePct: cur.avgPct,
      avgScorePctPrev: prev.avgPct,
      avgAccuracyPct,
      avgAccuracyPctPrev: 0,
      avgTimeMin: cur.avgTimeMin,
      avgTimeMinPrev: prev.avgTimeMin,
      weeklyTrend,
      completed: last30.length,
      inProgress: inProgressCount,
      notAttempted,
      topStudents,
      recentTests,
      totalUsers,
      activeUsers30d: activeUserSessions.length,
    };
  }

  const activityTotal = performance ? performance.completed + performance.inProgress + performance.notAttempted : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {session.name.split(" ")[0]}</h1>
          <p className="text-slate-500 text-sm mt-1">Here's what's happening on the platform right now.</p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium hidden md:block">
          {thirtyDaysAgo.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
          {now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((s) => {
          const style = ICON_STYLE[s.label];
          return (
            <div key={s.label} className="card">
              <div className={`w-10 h-10 rounded-full ${style.bg} ${style.text} flex items-center justify-center mb-3`}>
                <span className="material-symbols-outlined">{style.icon}</span>
              </div>
              <div className="text-sm font-medium text-slate-800">{s.label}</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">Total {s.label.toLowerCase()}</div>
            </div>
          );
        })}
      </div>

      {manager && pendingApproval > 0 && (
        <Link
          href="/admin/tests"
          className="card flex items-center justify-between bg-amber-50 border border-warning/20 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-warning">hourglass_top</span>
            <div>
              <div className="font-medium text-slate-800">
                {pendingApproval} test{pendingApproval > 1 ? "s" : ""} waiting for your approval
              </div>
              <div className="text-xs text-slate-500">Review and publish them from Manage Tests</div>
            </div>
          </div>
          <span className="text-warning text-sm font-medium">Review →</span>
        </Link>
      )}

      {performance && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Performance Overview */}
            <div className="lg:col-span-8 card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Performance Overview</h2>
                <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">Last 30 Days</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Total Attempts</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{performance.totalAttempts}</span>
                    <span
                      className={`text-xs font-medium ${
                        performance.totalAttempts >= performance.totalAttemptsPrev ? "text-success" : "text-danger"
                      }`}
                    >
                      {fmtDelta(
                        performance.totalAttemptsPrev > 0
                          ? ((performance.totalAttempts - performance.totalAttemptsPrev) / performance.totalAttemptsPrev) * 100
                          : 0
                      )}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Avg. Score</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{performance.avgScorePct.toFixed(0)}%</span>
                    <span className={`text-xs font-medium ${performance.avgScorePct >= performance.avgScorePctPrev ? "text-success" : "text-danger"}`}>
                      {fmtDelta(performance.avgScorePct - performance.avgScorePctPrev)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Avg. Accuracy</div>
                  <div className="text-2xl font-bold text-slate-900">{performance.avgAccuracyPct.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Avg. Time / Test</div>
                  <div className="text-2xl font-bold text-slate-900">{performance.avgTimeMin.toFixed(0)}m</div>
                </div>
              </div>

              <div className="h-48 w-full relative">
                {(() => {
                  const W = 1000;
                  const H = 180;
                  const maxVal = Math.max(...performance.weeklyTrend.map((p) => p.avgPct), 10);
                  const coords = performance.weeklyTrend.map((p, i) => ({
                    x: (i / (performance.weeklyTrend.length - 1 || 1)) * W,
                    y: H - (p.avgPct / maxVal) * (H - 10),
                    label: p.label,
                    val: p.avgPct,
                  }));
                  const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
                  return (
                    <>
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
                        <line x1="0" x2={W} y1={H} y2={H} stroke="#E1E3E4" strokeWidth="1" />
                        <polyline points={points} fill="none" stroke="#9D4400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {coords.map((c, i) => (
                          <circle key={i} cx={c.x} cy={c.y} r="5" fill="white" stroke="#9D4400" strokeWidth="2" />
                        ))}
                      </svg>
                      <div className="flex justify-between text-xs text-slate-400 mt-2">
                        {coords.map((c, i) => (
                          <span key={i}>{c.label}</span>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Test Activity */}
            <div className="lg:col-span-4 card">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Test Activity (30d)</h2>
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-slate-900">{activityTotal}</div>
                <div className="text-xs text-slate-400">Total Attempts</div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-success" /> Completed
                  </span>
                  <span className="font-medium">
                    {performance.completed} ({activityTotal > 0 ? Math.round((performance.completed / activityTotal) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> In Progress
                  </span>
                  <span className="font-medium">
                    {performance.inProgress} ({activityTotal > 0 ? Math.round((performance.inProgress / activityTotal) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Never Attempted
                  </span>
                  <span className="font-medium">{performance.notAttempted} students</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top Performing Students */}
            <div className="lg:col-span-4 card">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Top Performing Students</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Student</th>
                    <th className="pb-2 text-right">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.topStudents.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 text-slate-500">#{i + 1}</td>
                      <td className="py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="py-2 text-right text-slate-600">{s.avgPct.toFixed(0)}%</td>
                    </tr>
                  ))}
                  {performance.topStudents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No submissions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent Tests */}
            <div className="lg:col-span-4 card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Recent Tests</h2>
                <Link href="/admin/tests" className="text-xs text-brand font-medium">
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {performance.recentTests.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-slate-500 text-lg">description</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{t.name}</div>
                        <div className="text-xs text-slate-400 truncate">{t.seriesName}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[t.status]}`}>
                        {t.status.replace("_", " ")}
                      </span>
                      <div className="text-xs text-slate-400 mt-0.5">{t.attemptCount} attempts</div>
                    </div>
                  </div>
                ))}
                {performance.recentTests.length === 0 && <div className="text-center text-slate-400 text-sm">No tests yet.</div>}
              </div>
            </div>

            {/* System Overview */}
            <div className="lg:col-span-4 card">
              <h2 className="text-lg font-bold text-slate-900 mb-4">System Overview</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-slate-400 text-lg">group</span> Total Users
                  </span>
                  <span className="font-bold text-slate-900">{performance.totalUsers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-slate-400 text-lg">person_check</span> Active Users (30d)
                  </span>
                  <span className="font-bold text-slate-900">{performance.activeUsers30d}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(manager
            ? [
                { href: "/admin/test-series", icon: "add_circle", label: "New Test Series" },
                { href: "/admin/questions", icon: "add_box", label: "Add Question" },
                { href: "/admin/users", icon: "person_add", label: "Add User" },
                { href: "/admin/notifications", icon: "campaign", label: "Send Notification" },
              ]
            : [
                { href: "/admin/questions", icon: "add_box", label: "Add Question" },
                { href: "/admin/tests", icon: "assignment", label: "Manage Tests" },
              ]
          ).map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card flex flex-col items-center justify-center text-center gap-2 py-6 hover:shadow-md hover:border-brand/30 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand">
                <span className="material-symbols-outlined">{a.icon}</span>
              </div>
              <span className="text-sm font-medium text-slate-800">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
