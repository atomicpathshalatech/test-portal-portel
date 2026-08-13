"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FormulaText from "@/components/FormulaText";
import FormulaEditor from "@/components/FormulaEditor";

type Translation = {
  language: string;
  statement: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  solution: string | null;
};
type ReviewQuestion = {
  id: string;
  questionCode: string | null;
  subject: string;
  translations: Translation[];
  stats: { correct: number; incorrect: number; unattempted: number };
};

export default function ReviewTestPage() {
  const { id: testId } = useParams<{ id: string }>();
  const [testName, setTestName] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/tests/${testId}/review-data`)
      .then((r) => r.json())
      .then((d) => {
        setTestName(d.testName);
        setTestStatus(d.testStatus);
        setQuestions(d.questions);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [testId]);

  async function saveCorrection(questionId: string, language: string, correctOptionIds: string[], solution: string) {
    await fetch(`/api/questions/${questionId}/correct-answer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, correctOptionIds, solution }),
    });
    load();
  }

  async function recalculate() {
    setRecalculating(true);
    setRecalcResult(null);
    const res = await fetch(`/api/tests/${testId}/recalculate`, { method: "POST" });
    const data = await res.json();
    setRecalculating(false);
    if (!res.ok) {
      setRecalcResult(data.message || "Failed");
      return;
    }
    setRecalcResult(`✓ ${data.changedCount} of ${data.totalAttempts} attempts had their score updated. Students were notified.`);
  }

  if (loading) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Review Test — {testName}</h1>
      <p className="text-slate-500 text-sm mb-6">
        Fix a wrong answer key or add/edit a solution. If you change a correct answer, click{" "}
        <strong>Recalculate Results</strong> below so every student's score, rank, and analytics update
        automatically.
      </p>

      <div className="card mb-6 flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-800">Recalculate Results</div>
          <div className="text-xs text-slate-500">
            Re-scores every submitted attempt against the current answer keys.
          </div>
        </div>
        <button onClick={recalculate} disabled={recalculating} className="btn-primary text-sm">
          {recalculating ? "Recalculating..." : "Recalculate Now"}
        </button>
      </div>
      {recalcResult && <div className="text-sm text-success mb-6">{recalcResult}</div>}

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const en = q.translations.find((t) => t.language === "en") || q.translations[0];
          const isExpanded = expandedId === q.id;
          return (
            <div key={q.id} className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
              >
                <div>
                  <span className="text-xs font-mono text-brand font-semibold mr-2">{q.questionCode}</span>
                  <span className="text-sm text-slate-700">
                    Q{idx + 1}. <FormulaText text={en?.statement?.slice(0, 80) || ""} />...
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                  <span className="text-success">{q.stats.correct}✓</span>
                  <span className="text-danger">{q.stats.incorrect}✗</span>
                  <span className="text-slate-400">{q.stats.unattempted}—</span>
                  <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && (
                <QuestionEditor
                  question={q}
                  onSave={(language, correctOptionIds, solution) =>
                    saveCorrection(q.id, language, correctOptionIds, solution)
                  }
                />
              )}
            </div>
          );
        })}
        {questions.length === 0 && <div className="card text-center text-slate-400">No questions in this test.</div>}
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
}: {
  question: ReviewQuestion;
  onSave: (language: string, correctOptionIds: string[], solution: string) => void;
}) {
  const [lang, setLang] = useState(question.translations[0]?.language || "en");
  const t = question.translations.find((tr) => tr.language === lang) || question.translations[0];
  const [correctIds, setCorrectIds] = useState<string[]>(t?.correctOptionIds || []);
  const [solution, setSolution] = useState(t?.solution || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = question.translations.find((tr) => tr.language === lang);
    setCorrectIds(current?.correctOptionIds || []);
    setSolution(current?.solution || "");
  }, [lang, question]);

  function toggleOption(id: string) {
    setCorrectIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(lang, correctIds, solution);
    setSaving(false);
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {question.translations.length > 1 && (
        <div className="flex gap-2">
          {question.translations.map((tr) => (
            <button
              key={tr.language}
              onClick={() => setLang(tr.language)}
              className={`text-xs px-3 py-1 rounded-full transition-all duration-150 active:scale-95 ${
                lang === tr.language ? "bg-brand text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tr.language.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="text-sm text-slate-800 mb-2">
          <FormulaText text={t?.statement || ""} />
        </p>
        {t && t.options.length === 0 ? (
          <>
            <label className="label text-xs">Correct Value (Integer/Numerical)</label>
            <input
              className="input font-mono text-sm max-w-xs"
              value={correctIds[0] || ""}
              onChange={(e) => setCorrectIds([e.target.value])}
            />
          </>
        ) : (
          <>
            <label className="label text-xs">Correct Answer — click to toggle</label>
            <div className="flex gap-2">
              {t?.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold active:scale-90 transition-all duration-150 ${
                    correctIds.includes(opt.id) ? "bg-success text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {opt.id}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <label className="label text-xs">Solution / Explanation ({lang === "hi" ? "हिंदी" : "English"})</label>
        <FormulaEditor value={solution} onChange={setSolution} rows={2} compact />
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
        {saving ? "Saving..." : "Save Correction"}
      </button>
    </div>
  );
}
