"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";
import { SYLLABUS } from "@/lib/syllabusData";

type QuestionRow = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  difficulty: string;
  pyqSource: string | null;
  archived: boolean;
  translations: { language: string; statement: string }[];
};

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];
const TYPES = [
  { value: "", label: "Any Type" },
  { value: "SINGLE_CORRECT", label: "Single Correct" },
  { value: "MULTIPLE_CORRECT", label: "Multiple Correct" },
  { value: "INTEGER", label: "Numerical" },
  { value: "STATEMENT_BASED", label: "Statement Based" },
  { value: "MATCH_COLUMN", label: "Match the Following" },
  { value: "ASSERTION_REASON", label: "Assertion & Reason" },
];

export default function QuestionSearchPage() {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [results, setResults] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chapters = subject ? Object.keys(SYLLABUS[subject] || {}) : [];

  function runSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (subject) params.set("subject", subject);
    if (chapter) params.set("chapter", chapter);
    if (type) params.set("type", type);
    if (difficulty) params.set("difficulty", difficulty);
    fetch(`/api/questions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    const t = setTimeout(runSearch, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, subject, chapter, type, difficulty]);

  function copyId(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function clearFilters() {
    setSearch("");
    setSubject("");
    setChapter("");
    setType("");
    setDifficulty("");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Search Question Bank</h1>
      <p className="text-slate-500 text-sm mb-6">
        Find a question, copy its ID, then use that ID to import it into any Test or DPP.
      </p>

      <div className="card mb-4">
        <input
          className="input text-base"
          placeholder="Search by Question ID, keywords, chapter, topic, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <select className="input text-sm" value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}>
            <option value="">Any Subject</option>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="input text-sm" value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={!subject}>
            <option value="">Any Chapter</option>
            {chapters.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select className="input text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Any Difficulty</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        {(search || subject || chapter || type || difficulty) && (
          <button onClick={clearFilters} className="text-xs text-brand underline mt-2 hover:opacity-70 transition-opacity duration-150">
            Clear Filters
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">{loading ? "Searching..." : `${results.length} result(s)`}</p>

      <div className="space-y-3">
        {results.map((q) => {
          const t = q.translations[0];
          return (
            <div key={q.id} className="card flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 flex-wrap">
                  <span className="font-mono text-brand font-semibold">{q.questionCode}</span>
                  <span>·</span>
                  <span>
                    {q.subject}
                    {q.chapter ? ` · ${q.chapter}` : ""}
                  </span>
                  <span>·</span>
                  <span>{q.type.replace(/_/g, " ")}</span>
                  <span>·</span>
                  <span>{q.difficulty}</span>
                  {q.pyqSource && (
                    <>
                      <span>·</span>
                      <span>{q.pyqSource}</span>
                    </>
                  )}
                  {q.archived && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Archived</span>}
                </div>
                <p className="text-sm text-slate-800 line-clamp-2">
                  <FormulaText text={t?.statement || ""} />
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => q.questionCode && copyId(q.questionCode)}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  {copiedId === q.questionCode ? "✓ Copied" : "📋 Copy ID"}
                </button>
                <div className="flex gap-2">
                  <Link href={`/admin/questions/review/${q.id}`} className="text-xs text-success hover:underline transition-all duration-150">
                    View
                  </Link>
                  <Link href={`/admin/questions/new?edit=${q.id}`} className="text-xs text-brand hover:underline transition-all duration-150">
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && results.length === 0 && (
          <div className="card text-center text-slate-400">No questions match your search.</div>
        )}
      </div>
    </div>
  );
}
