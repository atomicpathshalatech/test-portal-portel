"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FormulaEditor from "@/components/FormulaEditor";
import Combobox from "@/components/Combobox";
import { SYLLABUS } from "@/lib/syllabusData";

type OptionRow = { id: string; text: string };
type LangContent = { statement: string; options: OptionRow[]; correctOptionIds: string[]; solution: string };
type Translation = { language: string; statement: string; options: OptionRow[]; correctOptionIds: string[]; solution?: string | null };
type QuestionFull = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  category: string | null;
  pyqSource: string | null;
  imageUrl: string | null;
  translations: Translation[];
};
type DppQuestionLink = { id: string; questionId: string; order: number; question: QuestionFull };
type DppData = {
  id: string;
  code: string;
  name: string;
  subject: string;
  chapter: string;
  topics: string[];
  status: string;
  questionTargetCount: number;
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  questions: DppQuestionLink[];
};

const QUESTION_TYPES = [
  { value: "SINGLE_CORRECT", label: "Single Choice" },
  { value: "MULTIPLE_CORRECT", label: "Multi Choice" },
  { value: "INTEGER", label: "Numerical" },
  { value: "MATCH_COLUMN", label: "Matrix Match" },
  { value: "STATEMENT_BASED", label: "Statement Based" },
  { value: "ASSERTION_REASON", label: "Assertion Reason" },
];

const emptyLang = (): LangContent => ({
  statement: "",
  options: [{ id: "A", text: "" }, { id: "B", text: "" }, { id: "C", text: "" }, { id: "D", text: "" }],
  correctOptionIds: [],
  solution: "",
});
const emptyIntegerLang = (): LangContent => ({ statement: "", options: [], correctOptionIds: [""], solution: "" });

type FormState = {
  chapter: string;
  topic: string;
  subTopic: string;
  type: string;
  difficulty: string;
  category: string;
  pyqSource: string;
  enableHi: boolean;
  enableEn: boolean;
  hi: LangContent;
  en: LangContent;
  imageUrl: string | null;
  existingQuestionId: string | null;
};

function blankForm(dpp: DppData): FormState {
  return {
    chapter: dpp.chapter,
    topic: dpp.topics[0] || "",
    subTopic: "",
    type: "SINGLE_CORRECT",
    difficulty: "MEDIUM",
    category: "PRACTICE",
    pyqSource: "",
    enableHi: dpp.languageMode !== "ENGLISH",
    enableEn: dpp.languageMode !== "HINDI",
    hi: emptyLang(),
    en: emptyLang(),
    imageUrl: null,
    existingQuestionId: null,
  };
}

function formFromQuestion(link: DppQuestionLink): FormState {
  const q = link.question;
  const hiT = q.translations.find((t) => t.language === "hi");
  const enT = q.translations.find((t) => t.language === "en");
  return {
    chapter: q.chapter || "",
    topic: q.topic || "",
    subTopic: q.subTopic || "",
    type: q.type,
    difficulty: q.difficulty,
    category: q.category || "PRACTICE",
    pyqSource: q.pyqSource || "",
    enableHi: !!hiT,
    enableEn: !!enT,
    hi: hiT ? { statement: hiT.statement, options: hiT.options, correctOptionIds: hiT.correctOptionIds, solution: hiT.solution || "" } : emptyLang(),
    en: enT ? { statement: enT.statement, options: enT.options, correctOptionIds: enT.correctOptionIds, solution: enT.solution || "" } : emptyLang(),
    imageUrl: q.imageUrl,
    existingQuestionId: q.id,
  };
}

export default function DppAddQuestionsPage() {
  const { id: dppId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dpp, setDpp] = useState<DppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<number>(Number(searchParams.get("slot")) || 1);
  const [form, setForm] = useState<FormState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiSolving, setAiSolving] = useState(false);
  const [aiResult, setAiResult] = useState<{ correctOptionId: string | null; confidence: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [metadataConfirmed, setMetadataConfirmed] = useState(false);
  const [subTopicSuggestions, setSubTopicSuggestions] = useState<string[]>([]);
  const [extractingScreenshot, setExtractingScreenshot] = useState(false);
  const [extractingSolutionImage, setExtractingSolutionImage] = useState(false);
  const [importByIdCode, setImportByIdCode] = useState("");
  const [importingById, setImportingById] = useState(false);
  const [checkingTranslation, setCheckingTranslation] = useState(false);
  const [autoTranslating, setAutoTranslating] = useState(false);
  const [translationCheck, setTranslationCheck] = useState<{
    verdict: string;
    issues: string;
    improvedHindiStatement?: string;
    improvedHindiOptions?: OptionRow[];
    improvedHindiSolution?: string;
  } | null>(null);
  const solutionImageInputRef = useRef<HTMLInputElement>(null);

  const loadDpp = useCallback(async () => {
    const res = await fetch(`/api/dpps/${dppId}`);
    const data: DppData = await res.json();
    setDpp(data);
    setLoading(false);
    return data;
  }, [dppId]);

  useEffect(() => {
    loadDpp();
  }, [loadDpp]);

  useEffect(() => {
    if (!dpp) return;
    const link = dpp.questions[slot - 1];
    const next = link ? formFromQuestion(link) : blankForm(dpp);
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setMetadataConfirmed(!!link);
  }, [dpp, slot]);

  useEffect(() => {
    if (!form?.topic) {
      setSubTopicSuggestions([]);
      return;
    }
    fetch(`/api/subtopics?topic=${encodeURIComponent(form.topic)}`)
      .then((r) => r.json())
      .then(setSubTopicSuggestions);
  }, [form?.topic]);

  const isDirty = form ? JSON.stringify(form) !== savedSnapshot : false;
  const isIntegerType = form?.type === "INTEGER" || form?.type === "NUMERICAL";

  useEffect(() => {
    if (!form) return;
    const shouldBeEmpty = isIntegerType;
    const hiIsEmpty = form.hi.options.length === 0;
    const enIsEmpty = form.en.options.length === 0;
    if (shouldBeEmpty && (!hiIsEmpty || !enIsEmpty)) {
      setForm({
        ...form,
        hi: { ...emptyIntegerLang(), statement: form.hi.statement, solution: form.hi.solution },
        en: { ...emptyIntegerLang(), statement: form.en.statement, solution: form.en.solution },
      });
    } else if (!shouldBeEmpty && (hiIsEmpty || enIsEmpty)) {
      setForm({
        ...form,
        hi: hiIsEmpty ? { ...emptyLang(), statement: form.hi.statement, solution: form.hi.solution } : form.hi,
        en: enIsEmpty ? { ...emptyLang(), statement: form.en.statement, solution: form.en.solution } : form.en,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.type]);

  function guardedGoTo(newSlot: number) {
    const action = () => {
      setSlot(newSlot);
      router.replace(`/admin/dpps/${dppId}/add-questions?slot=${newSlot}`);
    };
    if (isDirty) setPendingNav(() => action);
    else action();
  }

  function updateStatementFor(lang: "hi" | "en", statement: string) {
    if (!form) return;
    setForm({ ...form, [lang]: { ...form[lang], statement } });
  }
  function updateOptionFor(lang: "hi" | "en", idx: number, text: string) {
    if (!form) return;
    const options = [...form[lang].options];
    options[idx] = { ...options[idx], text };
    setForm({ ...form, [lang]: { ...form[lang], options } });
  }
  function toggleCorrectFor(lang: "hi" | "en", optionId: string) {
    if (!form) return;
    const isMulti = form.type === "MULTIPLE_CORRECT";
    let ids = form[lang].correctOptionIds;
    ids = isMulti ? (ids.includes(optionId) ? ids.filter((i) => i !== optionId) : [...ids, optionId]) : [optionId];
    setForm({ ...form, hi: { ...form.hi, correctOptionIds: ids }, en: { ...form.en, correctOptionIds: ids } });
  }
  function updateCorrectValueFor(value: string) {
    if (!form) return;
    setForm({ ...form, hi: { ...form.hi, correctOptionIds: [value] }, en: { ...form.en, correctOptionIds: [value] } });
  }

  function validateForSave(): string | null {
    if (!form) return "No form data";
    if (!form.chapter) return "Chapter is required.";
    if (!form.enableHi && !form.enableEn) return "Enable at least one language.";
    const langs: { key: "hi" | "en"; label: string; enabled: boolean; data: LangContent }[] = [
      { key: "hi", label: "Hindi", enabled: form.enableHi, data: form.hi },
      { key: "en", label: "English", enabled: form.enableEn, data: form.en },
    ];
    for (const l of langs) {
      if (!l.enabled) continue;
      if (!l.data.statement.trim()) return `${l.label} statement is required.`;
      if (!l.data.solution.trim()) return `${l.label} solution is required.`;
      if (isIntegerType) {
        if (!l.data.correctOptionIds[0]) return `${l.label}: enter the correct value.`;
      } else {
        const empty = l.data.options.find((o) => !o.text.trim());
        if (empty) return `${l.label}: Option ${empty.id} cannot be empty.`;
        if (l.data.correctOptionIds.length === 0) return `${l.label}: select the correct option.`;
      }
    }
    return null;
  }

  async function handleSave() {
    if (!form || !dpp) return;
    const err = validateForSave();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError("");

    const translations: any = {};
    if (form.enableHi) translations.hi = form.hi;
    if (form.enableEn) translations.en = form.en;

    const payload = {
      subject: dpp.subject,
      chapter: form.chapter,
      topic: form.topic,
      subTopic: form.subTopic,
      type: form.type,
      difficulty: form.difficulty,
      category: form.category,
      pyqSource: form.pyqSource,
      imageUrl: form.imageUrl,
      translations,
    };

    let questionId = form.existingQuestionId;
    if (questionId) {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaving(false);
        setError(d.message || "Failed to save");
        return;
      }
    } else {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(created.message || "Failed to save");
        return;
      }
      questionId = created.id;
      await fetch(`/api/dpps/${dppId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
    }

    const fresh = await loadDpp();
    const link = fresh.questions[slot - 1];
    const next = link ? formFromQuestion(link) : form;
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setSaving(false);

    if (pendingNav) {
      const fn = pendingNav;
      setPendingNav(null);
      fn();
    }
  }

  function discardChanges() {
    if (!form) return;
    setForm(JSON.parse(savedSnapshot));
    if (pendingNav) {
      const fn = pendingNav;
      setPendingNav(null);
      fn();
    }
  }

  async function handleAiSolve() {
    if (!form || !dpp) return;
    const primaryLang: "hi" | "en" = form.enableEn ? "en" : "hi";
    const langData = form[primaryLang];
    if (!langData.statement.trim()) {
      setError("Write the question statement first.");
      return;
    }
    setAiSolving(true);
    setError("");
    const res = await fetch("/api/ai/solve-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: dpp.subject,
        chapter: form.chapter,
        topic: form.topic,
        statement: langData.statement,
        options: langData.options,
        language: form.enableHi && form.enableEn ? "both" : primaryLang,
        questionType: form.type,
      }),
    });
    const data = await res.json();
    setAiSolving(false);
    if (!res.ok) {
      setError(data.message || "AI solve failed");
      return;
    }
    if (form.enableHi && form.enableEn) {
      setForm({ ...form, hi: { ...form.hi, solution: data.solution_hi || "" }, en: { ...form.en, solution: data.solution_en || "" } });
    } else {
      setForm({ ...form, [primaryLang]: { ...form[primaryLang], solution: data.solution || "" } });
    }
    setAiResult({ correctOptionId: data.correctOptionId, confidence: data.confidence });
  }

  function applyAiAnswer() {
    if (!form || !aiResult?.correctOptionId) return;
    if (isIntegerType) updateCorrectValueFor(aiResult.correctOptionId);
    else setForm({ ...form, hi: { ...form.hi, correctOptionIds: [aiResult.correctOptionId] }, en: { ...form.en, correctOptionIds: [aiResult.correctOptionId] } });
  }

  async function handleCheckTranslation() {
    if (!form) return;
    if (!form.hi.statement.trim() || !form.en.statement.trim()) {
      setError("Fill in both Hindi and English statements first.");
      return;
    }
    setCheckingTranslation(true);
    setTranslationCheck(null);
    const res = await fetch("/api/ai/check-translation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hindiStatement: form.hi.statement,
        englishStatement: form.en.statement,
        hindiOptions: form.hi.options,
        englishOptions: form.en.options,
        hindiSolution: form.hi.solution,
        englishSolution: form.en.solution,
      }),
    });
    const data = await res.json();
    setCheckingTranslation(false);
    if (!res.ok) {
      setError(data.message || "Translation check failed");
      return;
    }
    setTranslationCheck({
      verdict: data.verdict,
      issues: data.issues || "",
      improvedHindiStatement: data.improvedHindiStatement,
      improvedHindiOptions: data.improvedHindiOptions,
      improvedHindiSolution: data.improvedHindiSolution,
    });
  }

  function applyImprovedHindi() {
    if (!form || !translationCheck?.improvedHindiStatement) return;
    setForm({
      ...form,
      hi: {
        ...form.hi,
        statement: translationCheck.improvedHindiStatement,
        options: translationCheck.improvedHindiOptions || form.hi.options,
        solution: translationCheck.improvedHindiSolution || form.hi.solution,
      },
    });
    setTranslationCheck(null);
  }

  async function handleAutoTranslate() {
    if (!form) return;
    const sourceLang: "hi" | "en" = form.enableHi ? "hi" : "en";
    const source = form[sourceLang];
    if (!source.statement.trim()) {
      setError("Write the question statement first.");
      return;
    }
    setAutoTranslating(true);
    setError("");
    const res = await fetch("/api/ai/translate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: dpp?.subject,
        sourceLang,
        statement: source.statement,
        options: isIntegerType ? undefined : source.options,
        solution: source.solution,
        isIntegerType,
      }),
    });
    const data = await res.json();
    setAutoTranslating(false);
    if (!res.ok) {
      setError(data.message || "Auto-translate failed");
      return;
    }
    const targetLang: "hi" | "en" = sourceLang === "hi" ? "en" : "hi";
    setForm({
      ...form,
      enableHi: true,
      enableEn: true,
      [targetLang]: {
        statement: data.statement || "",
        options: isIntegerType ? [] : data.options || source.options,
        correctOptionIds: source.correctOptionIds,
        solution: data.solution || "",
      },
    });
  }

  async function handleScreenshotPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items || !form) return;
    let file: File | null = null;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        file = item.getAsFile();
        break;
      }
    }
    if (!file) return;
    e.preventDefault();
    setExtractingScreenshot(true);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file!);
      });
      const res = await fetch("/api/ai/extract-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Couldn't extract a question from that screenshot.");
        return;
      }
      const nextForm = { ...form };
      if (data.isIntegerType) nextForm.type = "INTEGER";
      if (data.statement_en) {
        nextForm.en = {
          statement: data.statement_en,
          options: data.isIntegerType ? [] : data.options_en || form.en.options,
          correctOptionIds: data.isIntegerType ? [""] : [],
          solution: form.en.solution,
        };
        nextForm.enableEn = true;
      }
      if (data.statement_hi) {
        nextForm.hi = {
          statement: data.statement_hi,
          options: data.isIntegerType ? [] : data.options_hi || form.hi.options,
          correctOptionIds: data.isIntegerType ? [""] : [],
          solution: form.hi.solution,
        };
        nextForm.enableHi = true;
      }
      setForm(nextForm);
      if (data.hasImage) {
        setError("⚠️ This screenshot appears to contain a diagram/figure — text was extracted, but please upload that image separately using the 🖼️ button in the statement box.");
      }
    } finally {
      setExtractingScreenshot(false);
    }
  }

  async function handleSolutionImageExtract(file: File) {
    if (!form) return;
    setExtractingSolutionImage(true);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ai/extract-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Couldn't extract a solution from that image.");
        return;
      }
      setForm({
        ...form,
        hi: { ...form.hi, solution: data.solution_hi || form.hi.solution },
        en: { ...form.en, solution: data.solution_en || form.en.solution },
      });
    } finally {
      setExtractingSolutionImage(false);
    }
  }

  async function handleImportById() {
    if (!importByIdCode.trim() || !dpp) return;
    setImportingById(true);
    setError("");
    const res = await fetch(`/api/questions?code=${encodeURIComponent(importByIdCode.trim().toUpperCase())}`);
    const found = await res.json();
    if (!res.ok || !found || (Array.isArray(found) && found.length === 0)) {
      setImportingById(false);
      setError(`No question found with ID "${importByIdCode}".`);
      return;
    }
    const question = Array.isArray(found) ? found[0] : found;
    const addRes = await fetch(`/api/dpps/${dppId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id }),
    });
    setImportingById(false);
    if (!addRes.ok) {
      const d = await addRes.json();
      setError(d.message || "Failed to import question");
      return;
    }
    setImportByIdCode("");
    const fresh = await loadDpp();
    guardedGoTo(fresh.questions.length);
  }

  if (loading || !dpp) return <div className="text-center text-slate-400 py-10">Loading...</div>;
  if (!form) return null;

  const added = dpp.questions.length;
  const target = dpp.questionTargetCount;
  const chapters = Object.keys(SYLLABUS[dpp.subject] || {});
  const topics = form.chapter ? SYLLABUS[dpp.subject]?.[form.chapter] || [] : [];
  const isNewSlot = !form.existingQuestionId;
  const showMetadataGate = isNewSlot && !metadataConfirmed;
  const canContinueMetadata = !!form.chapter;

  return (
    <div className="fixed inset-0 flex flex-col bg-panel z-[100]">
      <div className="bg-white border-b px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/admin/dpps" className="text-sm text-brand flex-shrink-0">← DPPs</Link>
          <span className="font-semibold text-slate-800 truncate max-w-[100px] sm:max-w-none">{dpp.name}</span>
          <span className="text-xs font-mono text-brand hidden sm:inline">{dpp.code}</span>
          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${dpp.status === "PUBLISHED" ? "bg-green-100 text-success" : "bg-slate-100 text-slate-600"}`}>
            {dpp.status}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <span className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">{added}/{target}</span>
          {dpp.status === "DRAFT" && (
            <button
              onClick={async () => {
                await fetch(`/api/dpps/${dppId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PUBLISHED" }) });
                loadDpp();
              }}
              disabled={added < target}
              title={added < target ? "Add all questions first" : ""}
              className="btn-primary text-xs sm:text-sm disabled:opacity-40 px-2.5 sm:px-5"
            >
              Publish
            </button>
          )}
          <button onClick={() => setDrawerOpen(true)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-slate-600 text-lg">tune</span>
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="bg-amber-500 text-white text-xs sm:text-sm px-3 sm:px-6 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-sm flex-shrink-0">warning</span>
          You have unsaved changes. Save before navigating.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        {error && <div className="text-sm text-danger mb-3">{error}</div>}

        <div className={showMetadataGate ? "pointer-events-none blur-sm select-none" : ""}>
          <div
            onPaste={handleScreenshotPaste}
            tabIndex={0}
            className="mb-4 border-2 border-dashed border-brand/30 rounded-xl p-4 text-center bg-brand-light/30 focus:outline-none focus:border-brand/60 cursor-text"
          >
            {extractingScreenshot ? (
              <p className="text-sm text-brand font-medium">⏳ Reading question from screenshot...</p>
            ) : (
              <p className="text-sm text-ink-soft">📋 Click here and paste (Ctrl+V) a screenshot — statement &amp; options will auto-fill</p>
            )}
          </div>

          <span className="text-xs text-slate-400 font-mono block mb-3">Q.{slot}</span>

          {form.imageUrl && (
            <div className="mb-4 relative inline-block">
              <img src={form.imageUrl} alt="" className="max-h-48 rounded-lg border" />
              <button onClick={() => setForm({ ...form, imageUrl: null })} className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs">✕</button>
            </div>
          )}

          {form.enableHi !== form.enableEn ? (
            <div className="flex items-center gap-2 mb-4">
              <button onClick={handleAutoTranslate} disabled={autoTranslating} className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200">
                {autoTranslating ? "Translating..." : `🌐 Auto-Translate to ${form.enableHi ? "English" : "Hindi"}`}
              </button>
            </div>
          ) : form.enableHi && form.enableEn ? (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <button onClick={handleCheckTranslation} disabled={checkingTranslation} className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200">
                  {checkingTranslation ? "Checking..." : "🔍 AI Check Hindi Translation"}
                </button>
                {translationCheck && (
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${translationCheck.verdict === "ACCURATE" ? "bg-green-100 text-success" : translationCheck.verdict === "PARTIALLY_ACCURATE" ? "bg-amber-100 text-warning" : "bg-red-100 text-danger"}`}>
                    {translationCheck.verdict.replace("_", " ")}{translationCheck.issues ? ` — ${translationCheck.issues}` : ""}
                  </span>
                )}
              </div>
              {translationCheck?.improvedHindiStatement && (
                <button onClick={applyImprovedHindi} className="text-xs text-brand underline self-start">✓ Apply AI's improved Hindi (NCERT terminology)</button>
              )}
            </div>
          ) : null}

          <div className={`grid gap-4 mb-4 ${form.enableHi && form.enableEn ? "md:grid-cols-2" : "grid-cols-1"}`}>
            {(["hi", "en"] as const)
              .filter((lang) => (lang === "hi" ? form.enableHi : form.enableEn))
              .map((lang) => {
                const langData = form[lang];
                return (
                  <div key={lang} className="flex flex-col gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${lang === "hi" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {lang === "hi" ? "हिंदी" : "English"}
                    </span>
                    <div className="card">
                      <FormulaEditor value={langData.statement} onChange={(v) => updateStatementFor(lang, v)} rows={3} placeholder={lang === "hi" ? "प्रश्न यहाँ लिखें..." : "Enter question statement..."} />
                    </div>
                    {isIntegerType ? (
                      <div className="card max-w-xs">
                        <label className="label text-xs">Correct Value</label>
                        <input className="input font-mono" value={langData.correctOptionIds[0] || ""} onChange={(e) => updateCorrectValueFor(e.target.value)} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {langData.options.map((opt, idx) => {
                          const isCorrect = langData.correctOptionIds.includes(opt.id);
                          return (
                            <div key={opt.id} className={`card relative ${isCorrect ? "border-2 border-success" : ""}`}>
                              <div className="flex items-start gap-2">
                                <button onClick={() => toggleCorrectFor(lang, opt.id)} className={`w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0 flex items-center justify-center ${isCorrect ? "bg-success text-white" : "bg-slate-100 text-slate-500"}`}>
                                  {opt.id}
                                </button>
                                <div className="flex-1">
                                  <FormulaEditor value={opt.text} onChange={(v) => updateOptionFor(lang, idx, v)} rows={1} compact placeholder={`Option ${opt.id}`} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="card">
                      <label className="label text-xs font-medium">💡 Solution ({lang === "hi" ? "हिंदी" : "English"}) <span className="text-danger">*</span></label>
                      <FormulaEditor value={langData.solution} onChange={(v) => setForm({ ...form, [lang]: { ...form[lang], solution: v } })} rows={2} placeholder="Required..." />
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={handleAiSolve} disabled={aiSolving} className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200">
              {aiSolving ? "Thinking..." : "✨ Solve with AI (fills solution in each enabled language)"}
            </button>
            <input
              ref={solutionImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSolutionImageExtract(file);
                e.target.value = "";
              }}
            />
            <button onClick={() => solutionImageInputRef.current?.click()} disabled={extractingSolutionImage} className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200">
              {extractingSolutionImage ? "Reading image..." : "📷 Upload Solution Image"}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">🔗 Import by Question ID:</span>
            <input
              className="input text-sm max-w-[160px] py-1.5 font-mono uppercase"
              placeholder="e.g. PH10025"
              value={importByIdCode}
              onChange={(e) => setImportByIdCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImportById()}
            />
            <button onClick={handleImportById} disabled={importingById || !importByIdCode.trim()} className="btn-secondary text-xs disabled:opacity-40">
              {importingById ? "Importing..." : "Add"}
            </button>
          </div>
          <div
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) handleSolutionImageExtract(file);
                  return;
                }
              }
            }}
            tabIndex={0}
            className="mb-4 border border-dashed border-purple-200 rounded-lg px-3 py-2 text-center bg-purple-50/40 focus:outline-none focus:border-purple-400 cursor-text text-xs text-purple-600"
          >
            {extractingSolutionImage ? "⏳ Reading solution from image..." : "📋 Or click here and paste (Ctrl+V) a solution screenshot"}
          </div>

          {aiResult && (
            <div className="text-xs rounded-lg px-3 py-2 mb-4 bg-purple-50 text-purple-700">
              AI confidence: <strong>{aiResult.confidence}</strong>
              {aiResult.correctOptionId && (
                <>
                  {" "}· AI suggests <strong>{aiResult.correctOptionId}</strong>
                  {form.en.correctOptionIds[0] !== aiResult.correctOptionId && (
                    <> — <button onClick={applyAiAnswer} className="underline font-medium">use AI's answer</button></>
                  )}
                </>
              )}
              <div className="mt-1 text-slate-500">⚠️ AI can make mistakes — always verify before publishing.</div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <button onClick={() => guardedGoTo(Math.max(1, slot - 1))} disabled={slot <= 1 || showMetadataGate} className="btn-secondary text-xs sm:text-sm disabled:opacity-40 order-1">← Prev</button>
        <span className="text-xs sm:text-sm text-slate-500 order-3 sm:order-2 w-full sm:w-auto text-center sm:text-left">Question {slot} / {target}</span>
        <div className="hidden sm:flex items-center gap-2 order-4">
          <span className="text-xs text-slate-400">Jump to</span>
          <input
            type="number"
            min={1}
            max={target}
            disabled={showMetadataGate}
            placeholder="#"
            className="w-14 text-sm border border-slate-200 rounded-lg px-2 py-1 text-center disabled:opacity-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number((e.target as HTMLInputElement).value);
                if (n >= 1 && n <= target) {
                  guardedGoTo(n);
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
        </div>
        <div className="flex gap-2 order-2 sm:order-5">
          <button onClick={handleSave} disabled={saving || !isDirty || showMetadataGate} className="btn-primary text-xs sm:text-sm disabled:opacity-40">
            {saving ? "Saving..." : isNewSlot ? "Save" : "Update"}
          </button>
          <button onClick={() => guardedGoTo(Math.min(target, slot + 1))} disabled={slot >= target || showMetadataGate} className="btn-secondary text-xs sm:text-sm disabled:opacity-40">Next →</button>
        </div>
      </div>

      {/* Mandatory Metadata Popup — gates a brand-new question slot */}
      {showMetadataGate && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-1">Question Metadata</h3>
            <p className="text-xs text-slate-500 mb-4">Complete this before the question editor opens — DPP: <strong>{dpp.name}</strong> ({dpp.subject})</p>

            <label className="label text-xs">Chapter *</label>
            <select className="input mb-3" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value, topic: "", subTopic: "" })}>
              <option value="">Select chapter...</option>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="label text-xs">Topic</label>
            <div className="mb-3">
              <Combobox value={form.topic} onChange={(v) => setForm({ ...form, topic: v, subTopic: "" })} options={topics} placeholder="Select or type a topic..." />
            </div>

            <label className="label text-xs">Sub Topic (optional)</label>
            <input className="input mb-3" list="gate-subtopic-opts" value={form.subTopic} onChange={(e) => setForm({ ...form, subTopic: e.target.value })} placeholder="E.g. Terminal Velocity" />
            <datalist id="gate-subtopic-opts">{subTopicSuggestions.map((s) => <option key={s} value={s} />)}</datalist>

            <label className="label text-xs">Question Type</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {QUESTION_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })} className={`text-xs px-3 py-2 rounded-lg border ${form.type === t.value ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <label className="label text-xs">Difficulty</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["EASY", "MEDIUM", "HARD"].map((d) => (
                <button key={d} type="button" onClick={() => setForm({ ...form, difficulty: d })} className={`text-xs px-3 py-2 rounded-lg border capitalize ${form.difficulty === d ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
                  {d.toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => router.push("/admin/dpps")} className="btn-secondary text-sm flex-1">Cancel</button>
              <button type="button" onClick={() => setMetadataConfirmed(true)} disabled={!canContinueMetadata} className="btn-primary text-sm flex-1 disabled:opacity-40">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata drawer (for existing questions) */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="w-full sm:w-96 bg-white h-full p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Question Metadata</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400">✕</button>
            </div>
            <label className="label text-xs">Chapter</label>
            <select className="input mb-4" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value, topic: "", subTopic: "" })}>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="label text-xs">Topic</label>
            <div className="mb-4">
              <Combobox value={form.topic} onChange={(v) => setForm({ ...form, topic: v, subTopic: "" })} options={topics} placeholder="Select or type a topic..." />
            </div>
            <label className="label text-xs">Sub Topic (optional)</label>
            <input className="input mb-4" list="subtopic-opts" value={form.subTopic} onChange={(e) => setForm({ ...form, subTopic: e.target.value })} />
            <datalist id="subtopic-opts">{subTopicSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
            <label className="label text-xs">Question Type</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {QUESTION_TYPES.map((t) => (
                <button key={t.value} onClick={() => setForm({ ...form, type: t.value })} className={`text-xs px-3 py-2 rounded-lg border ${form.type === t.value ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <label className="label text-xs">Difficulty</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["EASY", "MEDIUM", "HARD"].map((d) => (
                <button key={d} onClick={() => setForm({ ...form, difficulty: d })} className={`text-xs px-3 py-2 rounded-lg border capitalize ${form.difficulty === d ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
                  {d.toLowerCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setDrawerOpen(false)} className="btn-primary w-full">Apply</button>
          </div>
        </div>
      )}

      {pendingNav && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="card max-w-sm text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-slate-500 mb-4">Save your changes before navigating, or discard them.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setPendingNav(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={discardChanges} className="bg-danger text-white px-4 py-2 rounded-lg text-sm">Discard</button>
              <button onClick={handleSave} className="btn-primary text-sm">Save First</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
