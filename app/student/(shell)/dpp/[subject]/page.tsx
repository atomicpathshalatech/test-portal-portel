import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SYLLABUS } from "@/lib/syllabusData";

export default async function DppChaptersPage({ params }: { params: { subject: string } }) {
  const subject = decodeURIComponent(params.subject);
  const session = getSession()!;

  const chapters = Object.keys(SYLLABUS[subject] || {});

  const dpps = await prisma.dpp.groupBy({
    by: ["chapter"],
    where: { subject, status: "PUBLISHED" },
    _count: { id: true },
  });
  const countByChapter = new Map(dpps.map((d) => [d.chapter, d._count.id]));

  return (
    <div>
      <Link href="/student/dpp" className="text-sm text-brand mb-2 inline-block">
        ← All Subjects
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-6">{subject} — Chapters</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {chapters.map((c, idx) => {
          const count = countByChapter.get(c) || 0;
          return (
            <Link
              key={c}
              href={`/student/dpp/${encodeURIComponent(subject)}/${encodeURIComponent(c)}`}
              className="card-interactive flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium text-ink">{c}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${count > 0 ? "bg-brand-light text-brand" : "bg-surface-container text-ink-soft"}`}>
                {count} DPP{count !== 1 ? "s" : ""}
              </span>
            </Link>
          );
        })}
        {chapters.length === 0 && <div className="text-ink-soft col-span-full text-center py-8">No chapters found for {subject}.</div>}
      </div>
    </div>
  );
}
