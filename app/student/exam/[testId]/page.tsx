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
  correctMarks: number;
  incorrectMarks: number;
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
  const [paletteOpen, setPaletteOpen] = useState(false);
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
    const hours = Math.floor(test.durationMin / 60);
    const durationLabel = isHi
      ? hours > 0 ? `${hours} घंटे` : `${test.durationMin} मिनट`
      : hours > 0 ? `${hours} hours` : `${test.durationMin} minutes`;
    const totalQuestions = flatQuestions.length;
    return (
      <div className="min-h-screen bg-slate-100 py-8 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-lg font-bold text-slate-900 mb-4 text-center">
            {isHi ? "महत्वपूर्ण निर्देश : Important Instructions" : "Important Instructions"}
          </h1>

          <h2 className="text-sm font-bold text-slate-700 mb-2">महत्वपूर्ण निर्देश :</h2>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 mb-6">
            <li>उत्तर पत्र इस परीक्षा पुस्तिका के अन्दर रखा है। जब आपको परीक्षा पुस्तिका खोलने को कहा जाए, तो उत्तर पत्र निकाल कर ध्यानपूर्वक मूल प्रति पर केवल नीले/काले बॉल पॉइंट पेन से विवरण भरें।</li>
            <li>परीक्षा की अवधि {durationLabel} है एवं परीक्षा पुस्तिका में {totalQuestions} प्रश्न हैं। प्रत्येक प्रश्न {test.correctMarks} अंक का है। प्रत्येक सही उत्तर के लिए परीक्षार्थी को {test.correctMarks} अंक दिए जाएंगे। प्रत्येक गलत उत्तर के लिए कुल योग में से {Math.abs(test.incorrectMarks)} अंक घटाया जाएगा। अधिकतम अंक {totalQuestions * test.correctMarks} हैं।</li>
            <li>इस पृष्ठ पर विवरण अंकित करने एवं उत्तर पत्र पर निशान लगाने के लिए केवल नीले/काले बॉल पॉइंट पेन का प्रयोग करें।</li>
            <li>रफ कार्य इस परीक्षा पुस्तिका में निर्धारित स्थान पर ही करें।</li>
            <li>परीक्षा समाप्त होने पर, परीक्षार्थी कक्ष/हॉल छोड़ने से पूर्व उत्तर पत्र (मूल प्रति एवं कार्यालय प्रति) कक्ष निरीक्षक को अवश्य सौंप दें। परीक्षार्थी अपने साथ प्रश्न पुस्तिका ले जा सकते हैं।</li>
          </ol>

          <h2 className="text-sm font-bold text-slate-700 mb-2">Important Instructions :</h2>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
            <li>The Answer Sheet is inside this Test Booklet. When you are directed to open the Test Booklet, take out the Answer Sheet and fill in the particulars on the ORIGINAL Copy carefully with blue/black ball point pen only.</li>
            <li>The test is of {durationLabel} duration and this Test Booklet contains {totalQuestions} questions. Each question carries {test.correctMarks} marks. For each correct response, the candidate will get {test.correctMarks} marks. For each incorrect response, {Math.abs(test.incorrectMarks)} mark{Math.abs(test.incorrectMarks) !== 1 ? "s" : ""} will be deducted from the total scores. The maximum marks are {totalQuestions * test.correctMarks}.</li>
            <li>Use Blue/Black Ball Point Pen only for writing particulars on this page/marking responses on Answer Sheet.</li>
            <li>Rough work is to be done in the space provided for this purpose in the Test Booklet only.</li>
            <li>On completion of the test, the candidate must hand over the Answer Sheet (ORIGINAL and OFFICE Copy) to the Invigilator before leaving the Room/Hall. The candidates are allowed to take away this Test Booklet with them.</li>
          </ol>

          {test.languageMode === "BOTH" && (
            <p className="text-xs text-slate-500 mt-4">
              {isHi
                ? "आप ऊपर दाईं ओर स्थित भाषा-बटन से किसी भी प्रश्न की भाषा अलग से बदल सकते हैं — अगला प्रश्न पुनः आपकी डिफ़ॉल्ट भाषा में दिखेगा।"
                : "You can switch the language for any individual question using the language button at the top-right — the next question will revert to your default language."}
            </p>
          )}

          <div className="text-xs text-danger font-medium mt-4 bg-red-50 rounded-lg px-3 py-2">
            <strong>Translation Notice</strong>
            <br />
            किसी भी प्रश्न के अनुवाद में अस्पष्टता की स्थिति में, अंग्रेजी संस्करण को ही अंतिम माना जाएगा।
            <br />
            In case of any ambiguity in translation of any question, English version shall be treated as final.
          </div>

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
      <div className="bg-white border-b px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
            <span className="text-base sm:text-lg">👤</span>
          </div>
          <div className="text-[11px] sm:text-xs text-slate-600 leading-tight min-w-0">
            <div className="truncate max-w-[140px] sm:max-w-none"><span className="font-semibold">Candidate:</span> {candidateName || "—"}</div>
            <div className="truncate max-w-[140px] sm:max-w-none hidden sm:block"><span className="font-semibold">Exam Name:</span> {test.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {test.languageMode === "BOTH" && (
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
                  <div className="border-t mt-1 pt-1 px-3 py-1 text-[10px] text-slate-400">
                    Applies to this question only — next question uses your default ({defaultLang === "hi" ? "हिंदी" : "English"}).
                  </div>
                </div>
              )}
            </div>
          )}
          {warningCount > 0 && (
            <div
              className={`text-xs sm:text-sm font-semibold px-1.5 sm:px-2 py-1 rounded whitespace-nowrap ${
                integrityScore >= 90
                  ? "bg-green-50 text-success"
                  : integrityScore >= 70
                  ? "bg-amber-50 text-warning"
                  : "bg-red-50 text-danger"
              }`}
            >
              {integrityScore}%
            </div>
          )}
          <div className="text-right">
            <div className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">Time Left</div>
            <div className="font-mono text-sm sm:text-lg text-danger font-semibold leading-none whitespace-nowrap">{formatTime(secondsLeft)}</div>
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

          {/* Previous/Next/Submit — sticky at the bottom on mobile so it's always reachable without scrolling */}
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
            <button onClick={() => handleSubmit(false)} className="ml-auto bg-danger text-white px-5 py-2 rounded-lg font-medium text-sm">
              Submit
            </button>
          </div>
        </div>

        {/* Mobile sticky bottom nav — always accessible, matches the desktop row above but fixed to viewport bottom */}
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
          <button onClick={() => handleSubmit(false)} className="ml-auto bg-danger text-white px-4 py-2 rounded-lg font-medium text-xs">
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
              Answered &amp; Marked (considered for evaluation)
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
