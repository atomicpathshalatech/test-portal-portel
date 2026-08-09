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
  const [paletteOpen, setPaletteOpen] = useState(false);
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
      <div className="bg-white border-b px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-semibold flex-shrink-0">DPP</span>
          <div className="text-xs text-slate-600 leading-tight min-w-0">
            <div className="font-semibold truncate max-w-[140px] sm:max-w-xs">{dpp.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {dpp.languageMode === "BOTH" && (
            <div className="relative">
              <div className="flex items-center rounded-full overflow-hidden shadow-md bg-gradient-to-r from-brand to-brand-dark">
                <button
                  onClick={() => setLangMenuOpen((o) => !o)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-white text-xs sm:text-sm font-medium whitespace-nowrap"
                >
                  <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-xs">🅰</span>
                  <span className="hidden xs:inline">{effectiveLang === "hi" ? "हिंदी" : "English"}</span>
                  {langOverride && <span className="text-[8px] sm:text-[9px] bg-white/25 px-1 sm:px-1.5 py-0.5 rounded-full hidden sm:inline">this Q only</span>}
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
            <div className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">Time Elapsed</div>
            <div className="font-mono text-sm sm:text-lg text-brand font-semibold leading-none whitespace-nowrap">{formatTime(secondsElapsed)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Question area */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto pb-24 md:pb-6 min-w-0">
          <div className="text-sm text-slate-500 mb-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="md:hidden flex items-center gap-1 text-xs bg-white border rounded-full px-3 py-1.5 shadow-sm flex-shrink-0"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              Palette
            </button>
            <span className="truncate">
              Q{currentIdx + 1}/{flatQuestions.length} <span className="hidden xs:inline">· [{currentQ.difficulty}]</span>
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

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 mt-6">
            <button onClick={saveAndNext} className="bg-success text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm">
              Save &amp; Next
            </button>
            <button onClick={clearResponse} className="btn-secondary text-sm py-2.5 sm:py-2">
              Clear
            </button>
            <button onClick={saveAndMarkStay} className="bg-warning text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm">
              Save &amp; Mark for Review
            </button>
            <button onClick={markForReview} className="bg-brand-dark text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm">
              Mark for Review &amp; Next
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 mt-4 pt-4 border-t">
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

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-3 py-2 flex items-center gap-2 z-30 safe-area-bottom">
          <button onClick={() => goTo(currentIdx - 1)} className="btn-secondary text-xs px-3 py-2" disabled={currentIdx === 0}>
            ← Back
          </button>
          <button
            onClick={() => goTo(currentIdx + 1)}
            className="btn-secondary text-xs px-3 py-2"
            disabled={currentIdx === flatQuestions.length - 1}
          >
            Next →
          </button>
          <button onClick={handleSubmit} className="ml-auto bg-danger text-white px-4 py-2 rounded-lg font-medium text-xs">
            Submit
          </button>
        </div>

        {/* Palette — static sidebar on desktop, bottom-sheet drawer on mobile */}
        {paletteOpen && (
          <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setPaletteOpen(false)} />
        )}
        <div
          className={`bg-white overflow-y-auto z-50 transition-transform
            md:static md:z-auto md:w-72 md:border-l md:translate-y-0 md:block md:p-4
            fixed left-0 right-0 bottom-0 max-h-[75vh] rounded-t-2xl shadow-2xl p-4 pb-8
            ${paletteOpen ? "translate-y-0" : "translate-y-full md:translate-y-0"}
          `}
        >
          <div className="md:hidden flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Question Palette</span>
            <button onClick={() => setPaletteOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              ✕
            </button>
          </div>
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
          <div className="hidden md:block text-sm font-semibold text-slate-700 mb-3">Question Palette</div>
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
            {flatQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => {
                  goTo(idx);
                  setPaletteOpen(false);
                }}
                className={`w-full aspect-square min-h-[2.5rem] rounded text-xs font-semibold ${stateColor[qState[q.id] || "NOT_VISITED"]} ${
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
