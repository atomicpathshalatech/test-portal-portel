import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DeleteQuestionButton from "@/components/DeleteQuestionButton";

export default async function ChapterQuestionsPage({
  params,
}: {
  params: { subject: string; chapter: string };
}) {
  const session = getSession()!;
  const subject = decodeURIComponent(params.subject);
  const chapter = decodeURIComponent(params.chapter);

  if (session.role === "TEACHER" && session.subject && session.subject !== subject) {
    redirect(`/admin/questions/${encodeURIComponent(session.subject)}`);
  }

  const questions = await prisma.question.findMany({
    where: { subject, chapter },
    orderBy: { createdAt: "desc" },
    include: { translations: true },
  });

  const difficultyColor: Record<string, string> = {
    EASY: "bg-green-100 text-green-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    HARD: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <Link href={`/admin/questions/${encodeURIComponent(subject)}`} className="text-sm text-brand mb-2 inline-block">
        ← {subject} Chapters
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{chapter}</h1>
          <p className="text-slate-500 text-sm mt-1">{subject} · {questions.length} question(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`/api/questions/export?format=xlsx&subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`}
            className="btn-secondary text-sm px-3 sm:px-5"
          >
            ⬇ Export
          </a>
          <Link
            href={`/admin/questions/new?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`}
            className="btn-primary text-sm px-3 sm:px-5"
          >
            + New Question
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Image</th>
              <th className="py-2 pr-4">Topic</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Difficulty</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Languages</th>
              <th className="py-2 pr-4">Statement (preview)</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => {
              const preview = q.translations[0]?.statement?.slice(0, 60) || "";
              return (
                <tr key={q.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-brand font-semibold">{q.questionCode || "—"}</td>
                  <td className="py-2 pr-4">
                    {q.imageUrl ? (
                      <img src={q.imageUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{q.topic || "—"}</td>
                  <td className="py-2 pr-4">{q.type.replace("_", " ")}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${difficultyColor[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {q.category === "PYQ" ? q.pyqSource || "PYQ" : q.category || "—"}
                  </td>
                  <td className="py-2 pr-4">{q.translations.map((t) => t.language.toUpperCase()).join(" + ")}</td>
                  <td className="py-2 pr-4 text-slate-500">{preview}...</td>
                  <td className="py-2 pr-4">
                    <Link
  href={`/admin/questions/new?edit=${q.id}`}
  className="text-brand text-xs underline mr-2 hover:opacity-70 transition-opacity duration-150"
>
  Edit
</Link>

<Link
  href={`/admin/questions/versions/${q.id}`}
  className="text-purple-600 text-xs underline mr-2 hover:opacity-70 transition-opacity duration-150"
>
  History
</Link>

<DeleteQuestionButton questionId={q.id} />
                  </td>
                </tr>
              );
            })}
            {questions.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">
                  No questions in this chapter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
