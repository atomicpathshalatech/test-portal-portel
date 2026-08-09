import { prisma } from "@/lib/prisma";
import { integrityBand, VIOLATION_LABELS, VIOLATION_WEIGHTS } from "@/lib/integrity";
import Link from "next/link";

export default async function AttemptTimelinePage({ params }: { params: { attemptId: string } }) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: params.attemptId },
    include: {
      student: { select: { name: true, email: true } },
      test: { select: { name: true } },
      violations: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!attempt || !attempt.test) {
    return <div className="text-slate-500">Attempt not found.</div>;
  }
  const test = attempt.test;

  const band = integrityBand(attempt.integrityScore);

  const events = [
    { label: "Exam Started", time: attempt.startedAt, detail: null as string | null },
    ...attempt.violations.map((v) => ({
      label: VIOLATION_LABELS[v.type] || v.type,
      time: v.timestamp,
      detail: `-${VIOLATION_WEIGHTS[v.type] ?? VIOLATION_WEIGHTS.UNKNOWN} points`,
    })),
    ...(attempt.submittedAt
      ? [{ label: `Exam ${attempt.status.replace("_", " ")}`, time: attempt.submittedAt, detail: null }]
      : []),
  ];

  return (
    <div className="max-w-2xl">
      <Link href="/admin/security" className="text-sm text-brand mb-4 inline-block">
        ← Back to Security Center
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">{attempt.student.name}</h1>
      <p className="text-slate-500 text-sm mb-6">
        {attempt.student.email} · {test.name}
      </p>

      <div className="card flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-slate-400">Exam Integrity Score</div>
          <div className={`text-3xl font-bold ${band.color}`}>{attempt.integrityScore}%</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Classification</div>
          <div className={`font-semibold ${band.color}`}>{band.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Total Violations</div>
          <div className="font-semibold text-slate-800">{attempt.violations.length}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4">Timeline</h2>
        <div className="space-y-3">
          {events.map((e, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              <div className="w-20 flex-shrink-0 text-slate-400 font-mono">
                {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  e.detail ? "bg-danger" : "bg-success"
                }`}
              />
              <div className="flex-1 text-slate-700">{e.label}</div>
              {e.detail && <div className="text-danger text-xs font-medium">{e.detail}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
