"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SYLLABUS } from "@/lib/syllabusData";
import DppActionsMenu from "@/components/DppActionsMenu";
import { getDppLevel } from "@/lib/dppLevels";

type DppRow = {
  id: string;
  code: string;
  name: string;
  subject: string;
  chapter: string;
  status: string;
  difficulty: string;
  level: number | null;
  questionTargetCount: number;
  createdBy: { name: string } | null;
  questions: { id: string }[];
  attempts?: { id: string }[];
};

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];

export default function AdminDppListPage() {
  const [dpps, setDpps] = useState<DppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (chapter) params.set("chapter", chapter);
    if (search) params.set("search", search);
    fetch(`/api/dpps?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setDpps(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, chapter, search]);

  const chapters = subject ? Object.keys(SYLLABUS[subject] || {}) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Daily Practice Problems</h1>
          <p className="text-slate-500 text-sm mt-1">Chapter-wise practice sets, reusing the same question engine as Tests.</p>
        </div>
        <Link href="/admin/dpps/new" className="btn-primary text-sm px-3 sm:px-5">
          + Create DPP
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select className="input sm:max-w-[180px] text-sm" value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}>
          <option value="">All Subjects</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input sm:max-w-[220px] text-sm" value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={!subject}>
          <option value="">All Chapters</option>
          {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input text-sm flex-1" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="text-slate-400 col-span-full text-center py-8">Loading...</div>
        ) : dpps.length === 0 ? (
          <div className="text-slate-400 col-span-full text-center py-8">No DPPs yet.</div>
        ) : (
          dpps.map((d) => {
            const added = d.questions.length;
            return (
              <div key={d.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-mono text-brand">{d.code}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === "PUBLISHED" ? "bg-green-100 text-success" : "bg-slate-100 text-slate-600"}`}>
                      {d.status}
                    </span>
                    <DppActionsMenu dppId={d.id} dppName={d.name} dppCode={d.code} status={d.status} hasAttempts={(d.attempts?.length || 0) > 0} onActionComplete={load} />
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{d.name}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {d.subject} · {d.chapter} · {d.difficulty}
                  {d.level && <span className="ml-1 text-brand font-semibold">· L{d.level}</span>}
                </p>
                <div className="text-xs text-slate-400 mb-3">
                  {added}/{d.questionTargetCount} questions · by {d.createdBy?.name || "—"}
                </div>
                <Link href={`/admin/dpps/${d.id}/add-questions`} className="btn-secondary text-sm w-full text-center block mb-2">
                  {added < d.questionTargetCount ? "Add Questions" : "Manage"}
                </Link>
                {d.status === "PUBLISHED" && (
                  <div className="flex gap-2 text-xs">
                    <a href={`/api/dpps/${d.id}/export-pdf`} className="text-brand underline flex-1 text-center">
                      Without Solutions
                    </a>
                    <a href={`/api/dpps/${d.id}/export-pdf?withSolutions=true`} className="text-success underline flex-1 text-center">
                      With Solutions
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
