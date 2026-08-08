import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];
const SUBJECT_ICON: Record<string, string> = { Physics: "⚛️", Chemistry: "🧪", Botany: "🌱", Zoology: "🐾" };

export default async function QuestionBankSubjectsPage() {
  const session = getSession()!;

  // Teachers are locked to one subject — skip straight to its chapter list.
  if (session.role === "TEACHER" && session.subject) {
    redirect(`/admin/questions/${encodeURIComponent(session.subject)}`);
  }

  const counts = await prisma.question.groupBy({
    by: ["subject"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.subject, c._count._all]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Question Bank</h1>
        <div className="flex gap-2">
          <Link href="/admin/questions/ai-generate" className="btn-secondary">
            ✨ AI Generate
          </Link>
          <Link href="/admin/questions/new" className="btn-primary">
            + New Question
          </Link>
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-6">Browse by subject, then chapter.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUBJECTS.map((s) => (
          <Link
            key={s}
            href={`/admin/questions/${encodeURIComponent(s)}`}
            className="card text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">{SUBJECT_ICON[s]}</div>
            <div className="font-semibold text-slate-800">{s}</div>
            <div className="text-xs text-slate-400 mt-1">{countMap[s] || 0} questions</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
