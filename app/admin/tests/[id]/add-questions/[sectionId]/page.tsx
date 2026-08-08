"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";

type FullTranslation = {
  language: string;
  statement: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
};
type Question = {
  id: string;
  questionCode: string | null;
  subject: string;
  difficulty: string;
  imageUrl?: string | null;
  solution?: string | null;
  translations: FullTranslation[];
};
type SectionData = {
  id: string;
  name: string;
  subject: string;
  targetCount: number;
  test: { id: string; name: string };
  questions: { question: Question }[];
};
type PrevTest = { id: string; name: string; code: string };

export default function SectionQuestionEntryPage() {
  const { id: testId, sectionId } = useParams<{ id: string; sectionId: string }>();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"none" | "bank" | "previous">("none");
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  // Import from Question Bank
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [bankSearch, setBankSearch] = useState("");

  // Import from Previous Test
  const [prevTests, setPrevTests] = useState<PrevTest[]>([]);
  const [selectedPrevTest, setSelectedPrevTest] = useState("");
  const [prevTestSections, setPrevTestSections] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");

  function load() {
    setLoading(true);
    fetch(`/api/sections/${sectionId}`)
      .then((r) => r.json())
      .then((d) => {
        setSection(d);
        setLoading(false);
        const addedId = searchParams.get("added");
        if (addedId) {
          const idx = d.questions.findIndex((q: any) => q.question.id === addedId);
          if (idx >= 0) setPreviewIdx(idx);
        }
      });
  }

  useEffect(() => {
    load();
  }, [sectionId]);

  async function openBank() {
    setMode("bank");
    if (!section) return;
    const res = await fetch(`/api/questions?subject=${encodeURIComponent(section.subject)}`);
    setBankQuestions(await res.json());
  }

  async function openPreviousTest() {
    setMode("previous");
    const res = await fetch("/api/tests");
    const all = await res.json();
    setPrevTests(all.filter((t: any) => t.id !== testId).map((t: any) => ({ id: t.id, name: t.name, code: t.code })));
  }

  async function handlePrevTestSelect(prevTestId: string) {
    setSelectedPrevTest(prevTestId);
    if (!prevTestId || !section) return;
    const res = await fetch(`/api/tests/${prevTestId}`);
    const test = await res.json();
    // Only show sections from the previous test matching this section's subject
    setPrevTestSections((test.sections || []).filter((s: any) => s.subject === section.subject));
  }

  async function addQuestion(questionId: string) {
    setStatus("Adding...");
    const res = await fetch(`/api/sections/${sectionId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setStatus(data.message || "Failed to add");
      return;
    }
    setStatus("✓ Added");
    const updated = await fetch(`/api/sections/${sectionId}`).then((r) => r.json());
    setSection(updated);
    const idx = updated.questions.findIndex((q: any) => q.question.id === questionId);
    if (idx >= 0) setPreviewIdx(idx);
  }

  async function removeQuestion(questionId: string) {
    await fetch(`/api/sections/${sectionId}/questions?questionId=${questionId}`, { method: "DELETE" });
    load();
  }

  async function importAllFromPrevSection(prevSection: any) {
    setImporting(true);
    let added = 0;
    for (const sq of prevSection.questions || []) {
      const res = await fetch(`/api/sections/${sectionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: sq.question.id }),
      });
      if (res.ok) added++;
    }
    setImporting(false);
    setStatus(`✓ Imported ${added} question(s) from "${prevSection.name}"`);
    load();
  }

  if (loading || !section) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  const addedIds = new Set(section.questions.map((q) => q.question.id));
  const filteredBank = bankQuestions.filter(
    (q) =>
      !bankSearch ||
      q.questionCode?.toLowerCase().includes(bankSearch.toLowerCase()) ||
      q.translations[0]?.statement?.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/tests/${testId}/add-questions`} className="text-sm text-brand mb-2 inline-block">
        ← Back to {section.test.name}
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">
        {section.name} <span className="text-slate-400 text-lg">({section.subject})</span>
      </h1>
      <p className="text-slate-500 text-sm mb-6">
        {section.questions.length} / {section.targetCount} questions added — subject is locked to{" "}
        <strong>{section.subject}</strong> for this section.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Link
          href={`/admin/questions/new?sectionId=${section.id}&subject=${encodeURIComponent(section.subject)}&testId=${testId}`}
          className="card text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-1">✍️</div>
          <div className="font-medium text-sm text-slate-800">Create New Question</div>
        </Link>
        <button onClick={openBank} className="card text-center hover:shadow-md transition-shadow">
          <div className="text-2xl mb-1">🏦</div>
          <div className="font-medium text-sm text-slate-800">Import from Question Bank</div>
        </button>
        <button onClick={openPreviousTest} className="card text-center hover:shadow-md transition-shadow">
          <div className="text-2xl mb-1">🔁</div>
          <div className="font-medium text-sm text-slate-800">Import from Previous Test</div>
        </button>
      </div>

      {status && <p className="text-sm text-brand mb-4">{status}</p>}

      {mode === "bank" && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800">
              {section.subject} — Question Bank ({filteredBank.length})
            </h3>
            <button onClick={() => setMode("none")} className="text-xs text-slate-400">
              Close
            </button>
          </div>
          <input
            className="input mb-3 text-sm"
            placeholder="Search by ID or statement..."
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
          />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {filteredBank.map((q) => {
              const already = addedIds.has(q.id);
              return (
                <div key={q.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-brand mr-2">{q.questionCode}</span>
                    <span className="text-xs text-slate-400 mr-2">[{q.difficulty}]</span>
                    <FormulaText text={q.translations[0]?.statement?.slice(0, 60) || ""} />
                  </div>
                  <button
                    onClick={() => addQuestion(q.id)}
                    disabled={already}
                    className={`text-xs px-3 py-1 rounded-full flex-shrink-0 ml-2 ${
                      already ? "bg-slate-100 text-slate-400" : "bg-brand text-white"
                    }`}
                  >
                    {already ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
            {filteredBank.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No {section.subject} questions in the bank yet — create one instead.
              </p>
            )}
          </div>
        </div>
      )}

      {mode === "previous" && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-800">Import from a Previous Test</h3>
            <button onClick={() => setMode("none")} className="text-xs text-slate-400">
              Close
            </button>
          </div>
          <select
            className="input mb-3 text-sm"
            value={selectedPrevTest}
            onChange={(e) => handlePrevTestSelect(e.target.value)}
          >
            <option value="">Select a test...</option>
            {prevTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
          {selectedPrevTest && prevTestSections.length === 0 && (
            <p className="text-sm text-slate-400">
              No {section.subject} sections found in that test.
            </p>
          )}
          {prevTestSections.map((ps) => (
            <div key={ps.id} className="flex items-center justify-between border rounded-lg p-3 text-sm mb-2">
              <div>
                <div className="font-medium text-slate-800">{ps.name}</div>
                <div className="text-xs text-slate-400">{ps.questions.length} questions</div>
              </div>
              <button
                onClick={() => importAllFromPrevSection(ps)}
                disabled={importing}
                className="btn-secondary text-xs"
              >
                {importing ? "Importing..." : "Import All"}
              </button>
            </div>
          ))}
        </div>
      )}

      {previewIdx !== null && section.questions[previewIdx] && (
        <div className="card mb-6 border-2 border-brand/20">
          {(() => {
            const q = section.questions[previewIdx].question;
            const t = q.translations.find((tr) => tr.language === "en") || q.translations[0];
            const isIntegerType = t?.options.length === 0;
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-brand font-semibold">{q.questionCode}</span>
                    <span className="text-slate-400">[{q.difficulty}]</span>
                  </div>
                  <button onClick={() => setPreviewIdx(null)} className="text-xs text-slate-400">
                    Close
                  </button>
                </div>
                {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-48 rounded-lg border mb-3" />}
                <p className="text-sm text-slate-800 mb-3">
                  <FormulaText text={t?.statement || ""} />
                </p>
                {isIntegerType ? (
                  <p className="text-sm text-success font-medium">
                    Correct Value: {t?.correctOptionIds[0]}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {t?.options.map((opt) => {
                      const isCorrect = t.correctOptionIds.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            isCorrect ? "bg-green-50 text-success font-medium" : "bg-slate-50"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs flex-shrink-0">
                            {opt.id}
                          </span>
                          <FormulaText text={opt.text} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.solution && (
                  <div className="mt-3 pt-3 border-t text-sm text-slate-600">
                    <span className="text-xs text-slate-400 block mb-1">Solution</span>
                    <FormulaText text={q.solution} />
                  </div>
                )}

                {/* Prev / Next navigation */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t">
                  <button
                    onClick={() => setPreviewIdx((i) => (i !== null && i > 0 ? i - 1 : i))}
                    disabled={previewIdx === 0}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    Question {previewIdx + 1} of {section.questions.length}
                  </span>
                  <button
                    onClick={() =>
                      setPreviewIdx((i) => (i !== null && i < section.questions.length - 1 ? i + 1 : i))
                    }
                    disabled={previewIdx === section.questions.length - 1}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <h3 className="font-medium text-slate-800 mb-3">Questions in this section</h3>
      <div className="space-y-2">
        {section.questions.map(({ question: q }, idx) => (
          <div
            key={q.id}
            onClick={() => setPreviewIdx(idx)}
            className="card flex items-center justify-between py-3 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex-1 min-w-0 text-sm">
              <span className="font-mono text-xs text-brand mr-2">{q.questionCode}</span>
              <span className="text-xs text-slate-400 mr-2">[{q.difficulty}]</span>
              <FormulaText text={q.translations[0]?.statement?.slice(0, 80) || ""} />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeQuestion(q.id);
              }}
              className="text-danger text-xs ml-3 flex-shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
        {section.questions.length === 0 && (
          <div className="card text-center text-slate-400">No questions added yet.</div>
        )}
      </div>
    </div>
  );
}
