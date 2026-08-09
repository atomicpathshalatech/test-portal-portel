"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import FormulaText from "@/components/FormulaText";

type Translation = { language: string; statement: string; options: { id: string; text: string }[] };
type Question = { id: string; difficulty: string; type: string; imageUrl?: string | null; translations: Translation[] };
type Section = { id: string; name: string; questions: Question[] };
type TestData = {
  id: string;
  name: string;
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  durationMin: number;
  closeTime: string;
  sections: Section[];
};

type QState = "NOT_VISITED" | "NOT_ANSWERED" | "ANSWERED" | "MARKED" | "ANSWERED_MARKED";
type Stage = "loading" | "language" | "instructions" | "exam";

export default function ExamPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();

  const [test, setTest] = useState<TestData | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [defaultLang, setDefaultLang] = useState<"hi" | "en">("en");
  const [langOverride, setLangOverride] = useState<"hi" | "en" | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [instructionsAgreed, setInstructionsAgreed] = useState(false);
  const [flatQuestions, setFlatQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [qState, setQState] = useState<Record<string, QState>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setCandidateName(d.name || ""));
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

  // 1. Start attempt + load exam data
  useEffect(() => {
    (async () => {
      const startRes = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      if (!startRes.ok) {
        const d = await startRes.json();
        alert(d.message);
        router.push("/student");
        return;
      }
      const attempt = await startRes.json();
      setAttemptId(attempt.id);

      const testRes = await fetch(`/api/tests/${testId}/for-exam`);
      const data: TestData = await testRes.json();
      setTest(data);
      setDefaultLang(data.languageMode === "HINDI" ? "hi" : "en");

      const all = data.sections.flatMap((s) => s.questions);
      setFlatQuestions(all);
      const initState: Record<string, QState> = {};
      all.forEach((q) => (initState[q.id] = "NOT_VISITED"));
      initState[all[0]?.id] = "NOT_ANSWERED";
      setQState(initState);

      const durationSec = data.durationMin * 60;
      setSecondsLeft(durationSec);

      // Bilingual tests let the student pick their default language first;
      // single-language tests skip straight to the instructions screen.
      setStage(data.languageMode === "BOTH" ? "language" : "instructions");
    })();
  }, [testId, router]);

  // Reset any per-question language override whenever the question changes —
  // an override only ever applies to the question it was made on; the next
  // question always starts back on the student's chosen default language.
  useEffect(() => {
    setLangOverride(null);
  }, [currentIdx]);

  // Fullscreen only once the student has actually entered the exam (not
  // during the language-choice / instructions screens).
  useEffect(() => {
    if (stage !== "exam") return;
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, [stage]);

  const logViolation = useCallback(
    async (type: string, message: string) => {
      if (!attemptId || submittedRef.current) return;
      const res = await fetch(`/api/attempts/${attemptId}/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setWarningCount(data.violationCount);
      setIntegrityScore(data.integrityScore);
      if (data.violationCount >= 3) {
        setWarningMsg("❌ Exam Integrity Violated — Your test has been auto-submitted.");
        handleSubmit(true);
      } else {
        setWarningMsg(`⚠ Warning ${data.violationCount}/3 — ${message}`);
      }
    },
    [attemptId]
  );

  // 3. Violation detection: tab switch / window blur / fullscreen exit
  useEffect(() => {
    if (stage !== "exam") return;
    function onVisibility() {
      if (document.hidden) logViolation("TAB_SWITCH", "You left the examination screen. Please return immediately.");
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) logViolation("FULLSCREEN_EXIT", "You exited fullscreen mode.");
    }
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [logViolation, stage]);

  // 4. Timer — only counts down once the student has actually entered the exam
  useEffect(() => {
    if (stage !== "exam" || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft > 0, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatTime(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }

  // Poll for forced logout (e.g. someone logged into this account on
  // another device under the single-session policy). Checked periodically
  // rather than on every request to keep this lightweight.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (submittedRef.current) return;
      const res = await fetch("/api/session/check");
      const data = await res.json();
      if (!data.valid) {
        clearInterval(interval);
        alert("आपका सत्र समाप्त हो गया है — शायद किसी अन्य डिवाइस से लॉगिन हुआ है।\n\nYour session has ended — possibly logged in from another device.");
        router.push("/");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const currentQ = flatQuestions[currentIdx];
  const effectiveLang = langOverride || defaultLang;
  const currentTranslation =
    currentQ?.translations.find((t) => t.language === effectiveLang) || currentQ?.translations[0];

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

  // Marks for review WITHOUT advancing to the next question — distinct from
  // "Mark for Review & Next", matching NTA's own CBT interface which offers
  // both.
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

  async function handleSubmit(isAuto = false) {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    await fetch(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: isAuto ? "AUTO" : "MANUAL" }),
    });
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push(`/student/result/${attemptId}`);
  }

  if (!test || !currentQ || stage === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading exam...</div>;
  }

  // ---- Stage 1: Choose Default Language (bilingual tests only) ----
  if (stage === "language") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Choose Your Default Language</h1>
          <p className="text-xs text-slate-500 mb-6">
            अपनी डिफ़ॉल्ट भाषा चुनें। आप परीक्षा के दौरान किसी भी प्रश्न की भाषा अलग से बदल सकते हैं।
            <br />
            You can still switch language for individual questions during the exam.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setDefaultLang("en");
                setStage("instructions");
              }}
              className="border-2 border-brand text-brand font-semibold py-3 rounded-xl hover:bg-brand-light transition-colors"
            >
              English
            </button>
            <button
              onClick={() => {
                setDefaultLang("hi");
                setStage("instructions");
              }}
              className="border-2 border-brand text-brand font-semibold py-3 rounded-xl hover:bg-brand-light transition-colors"
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Stage 2: General Instructions ----
  if (stage === "instructions") {
    const isHi = defaultLang === "hi";
    return (
      <div className="min-h-screen bg-slate-100 py-8 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1 text-center">
            {isHi ? "कृपया निम्नलिखित निर्देशों को ध्यान से पढ़ें" : "Please read the instructions carefully"}
          </h1>
          <h2 className="text-sm font-bold text-slate-700 mt-6 mb-2 underline">
            {isHi ? "सामान्य अनुदेश:" : "General Instructions:"}
          </h2>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
            <li>{isHi ? `परीक्षा की कुल अवधि ${test.durationMin} मिनट है।` : `Total duration of this exam is ${test.durationMin} minutes.`}</li>
            <li>{isHi ? "स्क्रीन के दाईं ओर प्रश्न पैलेट में प्रत्येक प्रश्न की स्थिति एक रंग/चिन्ह से दिखाई जाएगी — देखा नहीं गया, उत्तर नहीं दिया, उत्तर दिया, समीक्षा हेतु चिन्हित।" : "The Question Palette on the right shows each question's status using a color/symbol — Not Visited, Not Answered, Answered, Marked for Review."}</li>
            <li>{isHi ? "किसी प्रश्न का उत्तर सुरक्षित करने के लिए Save & Next पर क्लिक करें।" : "Click Save & Next to save your answer and move to the next question."}</li>
            <li>{isHi ? "उत्तर बदलने के लिए, दूसरा विकल्प चुनें और फिर से Save & Next दबाएँ।" : "To change your answer, select a different option and click Save & Next again."}</li>
            <li>{isHi ? "किसी प्रश्न को समीक्षा हेतु चिन्हित करने के लिए Mark for Review & Next पर क्लिक करें।" : "Click Mark for Review & Next to flag a question for later review."}</li>
            <li>{isHi ? "समय समाप्त होने पर परीक्षा स्वतः जमा हो जाएगी।" : "When the timer reaches zero, the exam will be submitted automatically."}</li>
            {test.languageMode === "BOTH" && (
              <li>{isHi ? "आप ऊपर दाईं ओर स्थित भाषा-बटन से किसी भी प्रश्न की भाषा अलग से बदल सकते हैं — अगला प्रश्न पुनः आपकी डिफ़ॉल्ट भाषा में दिखेगा।" : "You can switch the language for any individual question using the language button at the top-right — the next question will revert to your default language."}</li>
            )}
          </ol>

          <p className="text-xs text-danger font-medium mt-6 bg-red-50 rounded-lg px-3 py-2">
            {isHi
              ? "कृपया ध्यान दें: सभी प्रश्न आपकी डिफ़ॉल्ट भाषा में दिखाई देंगे। यह भाषा बाद में किसी विशेष प्रश्न के लिए बदली जा सकती है।"
              : "Please note all questions will appear in your default language. This language can be changed for a particular question later on."}
          </p>

          <label className="flex items-start gap-2 mt-6 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={instructionsAgreed} onChange={(e) => setInstructionsAgreed(e.target.checked)} />
            <span>
              {isHi
                ? "मैंने उपरोक्त सभी निर्देशों को पढ़ और समझ लिया है। मैं सहमत हूं कि निर्देशों का पालन न करने की स्थिति में अनुशासनात्मक कार्रवाई हो सकती है।"
                : "I have read and understood the instructions above. I agree that failure to adhere to them may result in disciplinary action."}
            </span>
          </label>

          <button
            onClick={() => setStage("exam")}
            disabled={!instructionsAgreed}
            className="w-full bg-success text-white font-bold py-3 rounded-xl mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isHi ? "आगे बढ़ें" : "PROCEED"}
          </button>
        </div>
      </div>
    );
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
    <div ref={containerRef} className="min-h-screen bg-slate-100 flex flex-col">
      {warningMsg && (
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">{warningMsg}</div>
      )}
      {/* Candidate header bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
            <span className="text-lg">👤</span>
          </div>
          <div className="text-xs text-slate-600 leading-tight">
            <div><span className="font-semibold">Candidate Name:</span> {candidateName || "—"}</div>
            <div><span className="font-semibold">Exam Name:</span> {test.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {test.languageMode === "BOTH" && (
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
                  <div className="border-t mt-1 pt-1 px-3 py-1 text-[10px] text-slate-400">
                    Applies to this question only — next question uses your default ({defaultLang === "hi" ? "हिंदी" : "English"}).
                  </div>
                </div>
              )}
            </div>
          )}
          {warningCount > 0 && (
            <div
              className={`text-sm font-semibold px-2 py-1 rounded ${
                integrityScore >= 90
                  ? "bg-green-50 text-success"
                  : integrityScore >= 70
                  ? "bg-amber-50 text-warning"
                  : "bg-red-50 text-danger"
              }`}
            >
              Integrity: {integrityScore}%
            </div>
          )}
          <div className="text-right">
            <div className="text-xs text-slate-500">Remaining Time</div>
            <div className="font-mono text-lg text-danger font-semibold leading-none">{formatTime(secondsLeft)}</div>
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
            <button onClick={() => handleSubmit(false)} className="ml-auto bg-danger text-white px-5 py-2 rounded-lg font-medium text-sm">
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
              Answered &amp; Marked (considered for evaluation)
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
