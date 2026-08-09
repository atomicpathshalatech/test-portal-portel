import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SYLLABUS } from "@/lib/syllabusData";

export default async function ChapterListPage({ params }: { params: { subject: string } }) {
  const session = getSession()!;
  const subject = decodeURIComponent(params.subject);

  // Rule 3: a Teacher can only browse their own subject.
  if (session.role === "TEACHER" && session.subject && session.subject !== subject) {
    redirect(`/admin/questions/${encodeURIComponent(session.subject)}`);
  }

  const counts = await prisma.question.groupBy({
    by: ["chapter"],
    where: { subject },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.chapter || "Uncategorized", c._count._all]));

  const syllabusChapters = Object.keys(SYLLABUS[subject] || {});
  // Include any chapter that has questions but isn't in the syllabus list
  // (e.g. custom/free-text chapters from before this feature existed).
  const extraChapters = Object.keys(countMap).filter((c) => !syllabusChapters.includes(c));
  const allChapters = [...syllabusChapters, ...extraChapters];

  return (
    <div>
      <Link href="/admin/questions" className="text-sm text-brand mb-2 inline-block">
        ← All Subjects
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{subject} — Chapters</h1>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/questions/export?format=xlsx&subject=${encodeURIComponent(subject)}`} className="btn-secondary text-sm px-3 sm:px-5">
            ⬇ Excel
          </a>
          <a href={`/api/questions/export?format=csv&subject=${encodeURIComponent(subject)}`} className="btn-secondary text-sm px-3 sm:px-5">
            ⬇ CSV
          </a>
          <Link href={`/admin/questions/new?subject=${encodeURIComponent(subject)}`} className="btn-primary text-sm px-3 sm:px-5">
            + New Question
          </Link>
        </div>
      </div>

      <div className="grid gap-2">
        {allChapters.map((chapter) => (
          <Link
            key={chapter}
            href={`/admin/questions/${encodeURIComponent(subject)}/${encodeURIComponent(chapter)}`}
            className="card flex items-center justify-between py-3 hover:shadow-md transition-shadow"
          >
            <span className="text-sm font-medium text-slate-800">{chapter}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                (countMap[chapter] || 0) > 0 ? "bg-brand-light text-brand" : "bg-slate-100 text-slate-400"
              }`}
            >
              {countMap[chapter] || 0} questions
            </span>
          </Link>
        ))}
        {allChapters.length === 0 && (
          <div className="card text-center text-slate-400">No chapters found for {subject}.</div>
        )}
      </div>
    </div>
  );
}
