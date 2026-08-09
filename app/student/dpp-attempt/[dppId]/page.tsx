"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import FormulaText from "@/components/FormulaText";

type Translation = { language: string; statement: string; options: { id: string; text: string }[] };
type Question = { id: string; difficulty: string; type: string; imageUrl?: string | null; translations: Translation[] };
type DppData = {
  id: string;
  name: string;
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  durationMin: number;
  sections: { id: string; name: string; questions: Question[] }[];
};

type QState = "NOT_VISITED" | "NOT_ANSWERED" | "ANSWERED" | "MARKED" | "ANSWERED_MARKED";

export default function DppPracticePage() {
  const { dppId } = useParams<{ dppId: string }>();
  const router = useRouter();

  const [dpp, setDpp] = useState<DppData | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [defaultLang, setDefaultLang] = useState<"hi" | "en">("en");
  const [langOverride, setLangOverride] = useState<"hi" | "en" | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [flatQuestions, setFlatQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [qState, setQState] = useState<Record<string, QState>>({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/bookmarks/ids")
      .then((r) => r.json())
      .then((ids: string[]) => setBookmarkedIds(new Set(ids)));
  }, []);

  async function toggleBookmark() {
    if (!currentQ) return;
    const isBookmarked = bookmarkedIds.has(currentQ.id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
    if (isBookmarked) {
      await fetch(`/api/bookmarks?questionId=${currentQ.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ.id }),
      });
    }
  }

  // 1. Start attempt (resumes an in-progress one automatically) + load questions
  useEffect(() => {
    (async () => {
      const startRes = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dppId }),
      });
      if (!startRes.ok) {
        const d = await startRes.json();
        alert(d.message);
        router.push("/student/dpp");
        return;
      }
      const attempt = await startRes.json();
      setAttemptId(attempt.id);

      const dppRes = await fetch(`/api/dpps/${dppId}/for-exam`);
      const data: DppData = await dppRes.json();
      setDpp(data);
      setDefaultLang(data.languageMode === "HINDI" ? "hi" : "en");

      const all = data.sections.flatMap((s) => s.questions);
      setFlatQuestions(all);
      const initState: Record<string, QState> = {};
      all.forEach((q) => (initState[q.id] = "NOT_VISITED"));
      initState[all[0]?.id] = "NOT_ANSWERED";
      setQState(initState);
    })();
  }, [dppId, router]);

  // Count-up timer (practice mode — no time limit, just shows elapsed time)
  useEffect(() => {
    const t = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function formatTime(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  const currentQ = flatQuestions[currentIdx];
  const effectiveLang = langOverride || defaultLang;
  const currentTranslation =
    currentQ?.translations.find((t) => t.language === effectiveLang) || currentQ?.translations[0];

  // Per-question language override resets whenever navigating to a
  // different question — the next question always shows in the default language.
  useEffect(() => {
    setLangOverride(null);
  }, [currentIdx]);

  async function saveAnswer(questionId: string, selected: string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
    if (!attemptId) return;
    fetch(`/api/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, selectedOptionIds: selected }),
    });
  }

  function selectOption(optionId: string) {
    if (!currentQ) return;
    const isMulti = currentQ.type === "MULTIPLE_CORRECT";
    let selected = answers[currentQ.id] || [];
    if (isMulti) {
      selected = selected.includes(optionId) ? selected.filter((i) => i !== optionId) : [...selected, optionId];
    } else {
      selected = [optionId];
    }
    saveAnswer(currentQ.id, selected);
    setQState((prev) => ({
      ...prev,
      [currentQ.id]: prev[currentQ.id] === "MARKED" || prev[currentQ.id] === "ANSWERED_MARKED" ? "ANSWERED_MARKED" : "ANSWERED",
    }));
  }

  function goTo(idx: number) {
    if (idx < 0 || idx >= flatQuestions.length) return;
    setCurrentIdx(idx);
    const q = flatQuestions[idx];
    setQState((prev) => ({
      ...prev,
      [q.id]: prev[q.id] === "NOT_VISITED" ? "NOT_ANSWERED" : prev[q.id],
    }));
  }

  function markForReview() {
    if (!currentQ) return;
    setQState((prev) => {
      const isAnswered = (answers[currentQ.id] || []).length > 0;
      return { ...prev, [currentQ.id]: isAnswered ? "ANSWERED_MARKED" : "MARKED" };
    });
    goTo(currentIdx + 1);
  }

  function saveAndMarkStay() {
    if (!currentQ) return;
    setQState((prev) => {
      const isAnswered = (answers[currentQ.id] || []).length > 0;
      return { ...prev, [currentQ.id]: isAnswered ? "ANSWERED_MARKED" : "MARKED" };
    });
  }

  function clearResponse() {
    if (!currentQ) return;
    saveAnswer(currentQ.id, []);
    setQState((prev) => ({
      ...prev,
      [currentQ.id]: prev[currentQ.id] === "MARKED" || prev[currentQ.id] === "ANSWERED_MARKED" ? "MARKED" : "NOT_ANSWERED",
    }));
  }

  function saveAndNext() {
    goTo(currentIdx + 1);
  }

  async function handleSubmit() {
    if (!attemptId) return;
    await fetch(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "MANUAL" }),
    });
    router.push(`/student/result/${attemptId}`);
  }

  if (!dpp || !currentQ) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading DPP...</div>;
  }

  const stateColor: Record<QState, string> = {
    NOT_VISITED: "bg-slate-200 text-slate-600",
    NOT_ANSWERED: "bg-red-500 text-white",
    ANSWERED: "bg-green-600 text-white",
    MARKED: "bg-purple-600 text-white",
    ANSWERED_MARKED: "bg-purple-600 text-white ring-2 ring-green-400",
  };

  const counts = flatQuestions.reduce(
    (acc, q) => {
      const s = qState[q.id] || "NOT_VISITED";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<QState, number>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-semibold">DPP Practice</span>
          <div className="text-xs text-slate-600 leading-tight">
            <div className="font-semibold">{dpp.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {dpp.languageMode === "BOTH" && (
            <div className="relative">
              <div className="flex items-center rounded-full overflow-hidden shadow-md bg-gradient-to-r from-brand to-brand-dark">
                <button
                  onClick={() => setLangMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium"
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">🅰</span>
                  {effectiveLang === "hi" ? "हिंदी" : "English"}
                  {langOverride && <span className="text-[9px] bg-white/25 px-1.5 py-0.5 rounded-full ml-1">this Q only</span>}
                  <span className="text-xs">▾</span>
                </button>
              </div>
              {langMenuOpen && (
                <div className="absolute right-0 mt-1.5 bg-white rounded-xl shadow-lg border py-1 w-40 z-20">
                  <button
                    onClick={() => {
                      setLangOverride("en");
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-light ${effectiveLang === "en" ? "text-brand font-semibold" : "text-slate-700"}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => {
                      setLangOverride("hi");
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-light ${effectiveLang === "hi" ? "text-brand font-semibold" : "text-slate-700"}`}
                  >
                    हिंदी
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="text-right">
            <div className="text-xs text-slate-500">Time Elapsed</div>
            <div className="font-mono text-lg text-brand font-semibold leading-none">{formatTime(secondsElapsed)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-sm text-slate-500 mb-2 flex items-center justify-between">
            <span>
              Question {currentIdx + 1} of {flatQuestions.length} · [{currentQ.difficulty}]
            </span>
            <button
              onClick={toggleBookmark}
              className={`text-lg ${bookmarkedIds.has(currentQ.id) ? "text-amber-500" : "text-slate-300"}`}
              title="Bookmark this question for later revision"
            >
              {bookmarkedIds.has(currentQ.id) ? "★" : "☆"}
            </button>
          </div>
          <div className="card">
            {currentQ.imageUrl && (
              <img
                src={currentQ.imageUrl}
                alt="Question diagram"
                className="max-h-72 rounded-lg border border-slate-200 mb-4"
              />
            )}
            <p className="text-slate-900 mb-4">
              <FormulaText text={currentTranslation?.statement || ""} />
            </p>
            <div className="space-y-2">
              {currentQ.type === "INTEGER" || currentQ.type === "NUMERICAL" ? (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">
                    Enter your {currentQ.type === "INTEGER" ? "integer" : "numerical"} answer:
                  </label>
                  <input
                    type="number"
                    step={currentQ.type === "NUMERICAL" ? "any" : "1"}
                    value={(answers[currentQ.id] || [])[0] || ""}
                    onChange={(e) => (e.target.value === "" ? clearResponse() : selectOption(e.target.value))}
                    className="input max-w-xs text-lg font-mono"
                    placeholder={currentQ.type === "INTEGER" ? "e.g. 42" : "e.g. 9.8"}
                  />
                </div>
              ) : (
                currentTranslation?.options.map((opt) => {
                  const selected = (answers[currentQ.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(opt.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border flex items-center gap-3 ${
                        selected ? "border-brand bg-brand-light" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                          selected ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {opt.id}
                      </span>
                      <FormulaText text={opt.text} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={saveAndNext} className="bg-success text-white px-4 py-2 rounded-lg font-medium text-sm">
              Save &amp; Next
            </button>
            <button onClick={clearResponse} className="btn-secondary text-sm">
              Clear
            </button>
            <button onClick={saveAndMarkStay} className="bg-warning text-white px-4 py-2 rounded-lg font-medium text-sm">
              Save &amp; Mark for Review
            </button>
            <button onClick={markForReview} className="bg-brand-dark text-white px-4 py-2 rounded-lg font-medium text-sm">
              Mark for Review &amp; Next
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <button onClick={() => goTo(currentIdx - 1)} className="btn-secondary text-sm" disabled={currentIdx === 0}>
              {"<< Back"}
            </button>
            <button
              onClick={() => goTo(currentIdx + 1)}
              className="btn-secondary text-sm"
              disabled={currentIdx === flatQuestions.length - 1}
            >
              {"Next >>"}
            </button>
            <button onClick={handleSubmit} className="ml-auto bg-danger text-white px-5 py-2 rounded-lg font-medium text-sm">
              Submit
            </button>
          </div>
        </div>

        {/* Palette */}
        <div className="w-72 bg-white border-l p-4 overflow-y-auto">
          <div className="border border-dashed rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center font-semibold">
                {counts.NOT_VISITED || 0}
              </span>
              Not Visited
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-red-500 text-white flex items-center justify-center font-semibold">
                {counts.NOT_ANSWERED || 0}
              </span>
              Not Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-green-600 text-white flex items-center justify-center font-semibold">
                {counts.ANSWERED || 0}
              </span>
              Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">
                {counts.MARKED || 0}
              </span>
              Marked for Review
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <span className="w-6 h-6 rounded-full bg-purple-600 text-white ring-2 ring-green-400 flex items-center justify-center font-semibold">
                {counts.ANSWERED_MARKED || 0}
              </span>
              Answered &amp; Marked
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-700 mb-3">Question Palette</div>
          <div className="grid grid-cols-5 gap-2">
            {flatQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => goTo(idx)}
                className={`w-10 h-10 rounded text-xs font-semibold ${stateColor[qState[q.id] || "NOT_VISITED"]} ${
                  idx === currentIdx ? "ring-2 ring-brand-dark" : ""
                }`}
              >
                {String(idx + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
