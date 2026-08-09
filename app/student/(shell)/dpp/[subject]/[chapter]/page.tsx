import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: "bg-green-100 text-success",
  MEDIUM: "bg-amber-100 text-warning",
  HARD: "bg-red-100 text-danger",
  MIXED: "bg-purple-100 text-purple-700",
};

export default async function DppListPage({ params }: { params: { subject: string; chapter: string } }) {
  const subject = decodeURIComponent(params.subject);
  const chapter = decodeURIComponent(params.chapter);
  const session = getSession()!;

  const dpps = await prisma.dpp.findMany({
    where: { subject, chapter, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      questions: { select: { id: true } },
      attempts: { where: { studentId: session.id }, select: { id: true, status: true } },
    },
  });

  return (
    <div>
      <Link href={`/student/dpp/${encodeURIComponent(subject)}`} className="text-sm text-brand mb-2 inline-block">
        ← {subject} Chapters
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">{chapter}</h1>
      <p className="text-ink-soft text-sm mb-6">{subject} · {dpps.length} DPP{dpps.length !== 1 ? "s" : ""}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dpps.map((d) => {
          const attempt = d.attempts[0];
          const isCompleted = attempt && attempt.status !== "IN_PROGRESS";
          const isInProgress = attempt && attempt.status === "IN_PROGRESS";
          return (
            <div key={d.id} className="card hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden">
              {isCompleted && (
                <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-green-100 text-success font-semibold">
                  ✓ Completed
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-brand">{d.code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_STYLE[d.difficulty]}`}>{d.difficulty}</span>
              </div>
              {d.level && (
                <div className="text-xs font-semibold text-brand mb-2">LEVEL {d.level}</div>
              )}
              <h3 className="font-semibold text-ink mb-1">{d.name}</h3>
              {d.facultyName && <p className="text-xs text-ink-soft mb-3">{d.facultyName}</p>}
              <div className="flex items-center gap-3 text-xs text-ink-soft mb-4">
                <span>📝 {d.questions.length} Qs</span>
                <span>⏱ {d.estimatedTimeMin} min</span>
                <span>{d.languageMode === "BOTH" ? "हिं/EN" : d.languageMode === "HINDI" ? "हिंदी" : "EN"}</span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/student/dpp-attempt/${d.id}`}
                  className="btn-primary text-sm flex-1 text-center"
                >
                  {isCompleted ? "Re-attempt" : isInProgress ? "Continue" : "Start DPP"}
                </Link>
                {isCompleted && (
                  <Link href={`/student/result/${attempt.id}`} className="btn-secondary text-sm">
                    Result
                  </Link>
                )}
              </div>
              <a href={`/api/dpps/${d.id}/export-pdf`} className="text-xs text-brand underline mt-2 inline-block">
                📄 Export PDF
              </a>
            </div>
          );
        })}
        {dpps.length === 0 && (
          <div className="text-ink-soft col-span-full text-center py-8">No DPPs published for this chapter yet.</div>
        )}
      </div>
    </div>
  );
}
