"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FormulaEditor from "@/components/FormulaEditor";
import FormulaText from "@/components/FormulaText";
import Combobox from "@/components/Combobox";
import { SYLLABUS, resolveBiologySubject } from "@/lib/syllabusData";

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
  solution: string | null;
  translations: Translation[];
};
type SectionQuestionLink = { id: string; questionId: string; order: number; marksOverride: number | null; negativeMarksOverride: number | null; question: QuestionFull };
type SectionData = { id: string; name: string; subject: string; targetCount: number; questions: SectionQuestionLink[] };
type TestData = { id: string; name: string; status: string; correctMarks: number; incorrectMarks: number; sections: SectionData[] };

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
  marksOverride: string;
  negativeMarksOverride: string;
  enableHi: boolean;
  enableEn: boolean;
  hi: LangContent;
  en: LangContent;
  imageUrl: string | null;
  existingQuestionId: string | null;
};

function blankForm(subject: string, chapter = ""): FormState {
  return {
    chapter,
    topic: "",
    subTopic: "",
    type: "SINGLE_CORRECT",
    difficulty: "MEDIUM",
    category: "PRACTICE",
    pyqSource: "",
    marksOverride: "",
    negativeMarksOverride: "",
    enableHi: true,
    enableEn: true,
    hi: emptyLang(),
    en: emptyLang(),
    imageUrl: null,
    existingQuestionId: null,
  };
}

function formFromQuestion(link: SectionQuestionLink): FormState {
  const q = link.question;
  const hiT = q.translations.find((t) => t.language === "hi");
  const enT = q.translations.find((t) => t.language === "en");
  return {
    chapter: q.chapter || "",
    topic: q.topic || "",
    subTopic: (q as any).subTopic || "",
    type: q.type,
    difficulty: q.difficulty,
    category: q.category || "PRACTICE",
    pyqSource: q.pyqSource || "",
    marksOverride: link.marksOverride != null ? String(link.marksOverride) : "",
    negativeMarksOverride: link.negativeMarksOverride != null ? String(link.negativeMarksOverride) : "",
    enableHi: !!hiT,
    enableEn: !!enT,
    hi: hiT
      ? { statement: hiT.statement, options: hiT.options, correctOptionIds: hiT.correctOptionIds, solution: (hiT as any).solution || "" }
      : emptyLang(),
    en: enT
      ? { statement: enT.statement, options: enT.options, correctOptionIds: enT.correctOptionIds, solution: (enT as any).solution || "" }
      : emptyLang(),
    imageUrl: q.imageUrl,
    existingQuestionId: q.id,
  };
}

export default function UnifiedQuestionAuthoringPage() {
  const { id: testId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(searchParams.get("section"));
  const [activeSlot, setActiveSlot] = useState<number>(Number(searchParams.get("slot")) || 1);
  const [form, setForm] = useState<FormState | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [activeLang, setActiveLang] = useState<"hi" | "en">("en");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sectionSidebarOpen, setSectionSidebarOpen] = useState(false);
  const [metadataConfirmed, setMetadataConfirmed] = useState(false);
  const [slotChoice, setSlotChoice] = useState<"none" | "new" | "import">("none");
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState<"none" | "previous">("none");
  const [importByIdCode, setImportByIdCode] = useState("");
  const [importingById, setImportingById] = useState(false);
  const [prevTests, setPrevTests] = useState<{ id: string; name: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [subTopicSuggestions, setSubTopicSuggestions] = useState<string[]>([]);
  const [aiSolving, setAiSolving] = useState(false);
  const [aiResult, setAiResult] = useState<{ correctOptionId: string | null; confidence: string } | null>(null);
  const [aiError, setAiError] = useState("");
  const [checkingTranslation, setCheckingTranslation] = useState(false);
  const [translationCheck, setTranslationCheck] = useState<{
    verdict: string;
    issues: string;
    improvedHindiStatement?: string;
    improvedHindiOptions?: OptionRow[];
    improvedHindiSolution?: string;
  } | null>(null);
  const [autoTranslating, setAutoTranslating] = useState(false);
  const [extractingSolutionImage, setExtractingSolutionImage] = useState(false);
  const solutionImageInputRef = useRef<HTMLInputElement>(null);
  const [extractingScreenshot, setExtractingScreenshot] = useState(false);

  useEffect(() => {
    if (!form?.topic) {
      setSubTopicSuggestions([]);
      return;
    }
    fetch(`/api/subtopics?topic=${encodeURIComponent(form.topic)}`)
      .then((r) => r.json())
      .then(setSubTopicSuggestions);
  }, [form?.topic]);

  const loadTest = useCallback(async () => {
    const res = await fetch(`/api/tests/${testId}`);
    const data: TestData = await res.json();
    setTest(data);
    setLoading(false);
    return data;
  }, [testId]);

  useEffect(() => {
    loadTest().then((data) => {
      const firstSection = data.sections[0];
      if (!activeSectionId && firstSection) setActiveSectionId(firstSection.id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSection = useMemo(() => test?.sections.find((s) => s.id === activeSectionId) || null, [test, activeSectionId]);

  // Load form data for the current slot whenever section/slot/test changes
  useEffect(() => {
    if (!activeSection) return;
    const link = activeSection.questions[activeSlot - 1];
    const next = link ? formFromQuestion(link) : blankForm(activeSection.subject, "");
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setActiveLang(next.enableEn ? "en" : "hi");
    // Existing questions already have their metadata — no need to re-gate.
    // A brand-new (empty) slot must go through the mandatory metadata popup first.
    setMetadataConfirmed(!!link);
    // Every fresh empty slot starts at the "Add New Question / Import
    // Question" choice screen — nothing opens automatically.
    setSlotChoice("none");
  }, [activeSection, activeSlot]);

  const isDirty = form ? JSON.stringify(form) !== savedSnapshot : false;

  function guardedNavigate(action: () => void) {
    if (isDirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  }

  function goToSlot(section: SectionData, slot: number) {
    guardedNavigate(() => {
      setActiveSectionId(section.id);
      setActiveSlot(slot);
      router.replace(`/admin/tests/${testId}/add-questions?section=${section.id}&slot=${slot}`);
    });
  }

  function validateForSave(): string | null {
    if (!form) return "No form data";
    if (!form.chapter) return "Chapter is required.";
    if (!form.topic) return "Topic is required.";

    const langs: { key: "hi" | "en"; label: string; enabled: boolean; data: LangContent }[] = [
      { key: "hi", label: "Hindi", enabled: form.enableHi, data: form.hi },
      { key: "en", label: "English", enabled: form.enableEn, data: form.en },
    ];
    if (!form.enableHi && !form.enableEn) return "Enable at least one language.";

    for (const l of langs) {
      if (!l.enabled) continue;
      if (!l.data.statement || !l.data.statement.trim()) return `${l.label} statement is required.`;
      if (!l.data.solution || !l.data.solution.trim()) return `${l.label} solution is required — every question must have an explanation in each enabled language.`;
      if (isIntegerType) {
        if (!l.data.correctOptionIds[0] || !String(l.data.correctOptionIds[0]).trim()) {
          return `${l.label}: enter the correct value.`;
        }
      } else {
        const emptyOption = l.data.options.find((o) => !o.text || !o.text.trim());
        if (emptyOption) return `${l.label}: Option ${emptyOption.id} cannot be empty.`;
        if (l.data.correctOptionIds.length === 0) return `${l.label}: select the correct option.`;
      }
    }
    return null;
  }

  async function handleSave() {
    if (!form || !activeSection) return;
    const validationError = validateForSave();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");

    const translations: any = {};
    if (form.enableHi) translations.hi = form.hi;
    if (form.enableEn) translations.en = form.en;

    const payload = {
      subject: resolveBiologySubject(activeSection.subject, form.chapter),
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
      await fetch(`/api/sections/${activeSection.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
    }

    if (questionId && (form.marksOverride || form.negativeMarksOverride)) {
      await fetch(`/api/sections/${activeSection.id}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marksOverride: form.marksOverride ? Number(form.marksOverride) : null,
          negativeMarksOverride: form.negativeMarksOverride ? Number(form.negativeMarksOverride) : null,
        }),
      });
    }

    const fresh = await loadTest();
    const freshSection = fresh.sections.find((s) => s.id === activeSection.id);
    const link = freshSection?.questions[activeSlot - 1];
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
    const current = form[lang];
    let ids = current.correctOptionIds;
    ids = isMulti ? (ids.includes(optionId) ? ids.filter((i) => i !== optionId) : [...ids, optionId]) : [optionId];
    // Option IDs (A/B/C/D) are positionally identical across languages —
    // marking the answer in one language marks the same option in the other.
    setForm({
      ...form,
      hi: { ...form.hi, correctOptionIds: ids },
      en: { ...form.en, correctOptionIds: ids },
    });
  }
  function updateCorrectValueFor(lang: "hi" | "en", value: string) {
    if (!form) return;
    setForm({
      ...form,
      hi: { ...form.hi, correctOptionIds: [value] },
      en: { ...form.en, correctOptionIds: [value] },
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploadingImage(false);
    if (res.ok) setForm({ ...form, imageUrl: data.url });
  }

  async function handleAiSolve() {
    if (!form || !activeSection) return;
    // Prefer English for determining the correct answer (more reliable model performance),
    // but request the solution text in whichever language(s) are enabled.
    const primaryLang: "hi" | "en" = form.enableEn ? "en" : "hi";
    const langData = form[primaryLang];
    if (!langData.statement.trim()) {
      setAiError("Write the question statement first.");
      return;
    }
    setAiSolving(true);
    setAiError("");
    setAiResult(null);
    const res = await fetch("/api/ai/solve-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: resolveBiologySubject(activeSection.subject, form.chapter),
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
      setAiError(data.message || "AI solve failed");
      return;
    }
    if (form.enableHi && form.enableEn) {
      setForm({
        ...form,
        hi: { ...form.hi, solution: data.solution_hi || "" },
        en: { ...form.en, solution: data.solution_en || "" },
      });
    } else {
      setForm({ ...form, [primaryLang]: { ...form[primaryLang], solution: data.solution || "" } });
    }
    setAiResult({ correctOptionId: data.correctOptionId, confidence: data.confidence });
  }

  function applyAiAnswer() {
    if (!form || !aiResult?.correctOptionId) return;
    if (isIntegerType) {
      updateCorrectValueFor("en", aiResult.correctOptionId);
    } else {
      setForm({
        ...form,
        hi: { ...form.hi, correctOptionIds: [aiResult.correctOptionId] },
        en: { ...form.en, correctOptionIds: [aiResult.correctOptionId] },
      });
    }
  }

  async function handleCheckTranslation() {
    if (!form) return;
    if (!form.hi.statement.trim() || !form.en.statement.trim()) {
      setAiError("Fill in both Hindi and English statements first.");
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
      setAiError(data.message || "Translation check failed");
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
      setAiError("Write the question statement first.");
      return;
    }
    setAutoTranslating(true);
    setAiError("");
    const res = await fetch("/api/ai/translate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: activeSection?.subject,
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
      setAiError(data.message || "Auto-translate failed");
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
    setAiError("");
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
        setAiError(data.message || "Couldn't extract a question from that screenshot.");
        return;
      }

      const nextForm = { ...form };
      if (data.isIntegerType) {
        nextForm.type = "INTEGER";
      }
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
        setAiError(
          "⚠️ This screenshot appears to contain a diagram/figure — text was extracted, but please upload that image separately using the 🖼️ button in the statement box."
        );
      }
    } finally {
      setExtractingScreenshot(false);
    }
  }

  async function handleSolutionImageExtract(file: File) {
    if (!form) return;
    setExtractingSolutionImage(true);
    setAiError("");
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
        setAiError(data.message || "Couldn't extract a solution from that image.");
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
    if (!importByIdCode.trim() || !activeSection) return;
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
    const addRes = await fetch(`/api/sections/${activeSection.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id }),
    });
    setImportingById(false);
    if (!addRes.ok) {
      const d = await addRes.json().catch(() => ({}));
      setError(d.message || "Failed to import question");
      return;
    }
    setImportByIdCode("");
    const fresh = await loadTest();
    const freshSection = fresh.sections.find((s) => s.id === activeSection.id);
    if (freshSection) goToSlot(freshSection, freshSection.questions.length);
  }

  async function openPrevious() {
    setImportMode("previous");
    const res = await fetch("/api/tests");
    const all = await res.json();
    setPrevTests(all.filter((t: any) => t.id !== testId).map((t: any) => ({ id: t.id, name: t.name })));
  }

  if (loading || !test) return <div className="text-center text-slate-400 py-10">Loading...</div>;
  if (!activeSection || !form) return <div className="text-center text-slate-400 py-10">No sections defined.</div>;

  const totalTarget = test.sections.reduce((s, sec) => s + sec.targetCount, 0);
  const totalAdded = test.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const sectionAdded = activeSection.questions.length;
  const sectionPct = activeSection.targetCount > 0 ? Math.round((sectionAdded / activeSection.targetCount) * 100) : 0;
  const chapters = Object.keys(SYLLABUS[activeSection.subject] || {});
  const topics = form.chapter ? SYLLABUS[activeSection.subject]?.[form.chapter] || [] : [];
  const isNewSlot = !form.existingQuestionId;
  const showChoiceScreen = isNewSlot && slotChoice === "none";
  const showMetadataGate = isNewSlot && slotChoice === "new" && !metadataConfirmed;
  const canContinueMetadata = !!(form.chapter && form.topic && (form.category !== "PYQ" || form.pyqSource));

  return (
    <div className="fixed inset-0 flex bg-panel z-[100]">
      {sectionSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSectionSidebarOpen(false)} />
      )}
      {/* Persistent left sidebar — drawer on mobile, static on desktop */}
      <aside
        className={`w-64 bg-brand-dark text-white flex flex-col flex-shrink-0 fixed md:static top-0 left-0 h-full z-50 transition-transform duration-200
          ${sectionSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="p-4 flex items-center justify-between gap-2">
          <Link href="/admin/tests" className="text-white/70 hover:text-white text-sm transition-colors duration-150">
            ← Back
          </Link>
          <button onClick={() => setSectionSidebarOpen(false)} className="md:hidden text-white/70 hover:text-white active:scale-90 transition-all duration-150 w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="px-4 pb-2">
          <h2 className="font-semibold text-sm truncate">{test.name}</h2>
          <div className="text-xs text-white/50 mt-1">{totalAdded} / {totalTarget} Questions</div>
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-brand-container" style={{ width: `${totalTarget > 0 ? (totalAdded / totalTarget) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {test.sections.map((sec) => {
            const pct = sec.targetCount > 0 ? Math.round((sec.questions.length / sec.targetCount) * 100) : 0;
            const active = sec.id === activeSectionId;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  goToSlot(sec, Math.min(sec.questions.length + 1, Math.max(sec.targetCount, 1)));
                  setSectionSidebarOpen(false);
                }}
                disabled={showMetadataGate}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${active ? "bg-white/15" : "hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{sec.name}</span>
                  <span className="text-xs text-white/60">{sec.questions.length}/{sec.targetCount}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full ${pct >= 100 ? "bg-success" : "bg-brand-container"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={() => setSectionSidebarOpen(true)} className="md:hidden w-8 h-8 flex items-center justify-center flex-shrink-0 -ml-1 active:scale-90 transition-transform duration-150">
              <span className="material-symbols-outlined text-slate-600">menu</span>
            </button>
            <span className="font-semibold text-slate-800 truncate max-w-[100px] sm:max-w-none">{activeSection.name}</span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase font-medium whitespace-nowrap">
              {test.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-right">
              <div className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">Section Progress</div>
              <div className="flex items-center gap-2">
                <div className="w-14 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${sectionPct}%` }} />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">{sectionAdded}/{activeSection.targetCount}</span>
              </div>
            </div>
            {form.enableHi && form.enableEn && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 font-medium hidden md:inline">
                हिंदी + English — side by side
              </span>
            )}
            <button onClick={() => setDrawerOpen(true)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 transition-all duration-150 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-slate-600 text-lg">tune</span>
            </button>
          </div>
        </div>

        {isDirty && (
          <div className="bg-amber-500 text-white text-xs sm:text-sm px-3 sm:px-6 py-2 flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-sm">warning</span>
            You have unsaved changes. Save before navigating.
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {error && <div className="text-sm text-danger mb-3">{error}</div>}

          {showChoiceScreen ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
                <button
                  onClick={() => setSlotChoice("new")}
                  className="card-interactive flex flex-col items-center justify-center text-center gap-2 py-10"
                >
                  <div className="text-3xl mb-1">➕</div>
                  <div className="font-semibold text-slate-800">Add New Question</div>
                  <div className="text-xs text-slate-400">Opens the full Question Builder</div>
                </button>
                <button
                  onClick={() => setSlotChoice("import")}
                  className="card-interactive flex flex-col items-center justify-center text-center gap-2 py-10"
                >
                  <div className="text-3xl mb-1">📥</div>
                  <div className="font-semibold text-slate-800">Import Question</div>
                  <div className="text-xs text-slate-400">Enter a Question ID from the Question Bank</div>
                </button>
              </div>
            </div>
          ) : slotChoice === "import" ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="card max-w-sm w-full text-center">
                <button
                  onClick={() => {
                    setSlotChoice("none");
                    setError("");
                  }}
                  className="text-xs text-brand hover:opacity-70 transition-opacity duration-150 mb-4"
                >
                  ← Back
                </button>
                <div className="text-3xl mb-2">📥</div>
                <h3 className="font-semibold text-slate-900 mb-1">Import Question</h3>
                <p className="text-xs text-slate-500 mb-4">Enter the Question ID exactly as shown in the Question Bank.</p>
                <input
                  className="input text-center font-mono uppercase mb-3"
                  placeholder="e.g. PH10025"
                  value={importByIdCode}
                  onChange={(e) => setImportByIdCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImportById()}
                  autoFocus
                />
                {error && <p className="text-xs text-danger mb-3">{error}</p>}
                <button onClick={handleImportById} disabled={importingById || !importByIdCode.trim()} className="btn-primary w-full disabled:opacity-40">
                  {importingById ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-mono">Q.{activeSlot}</span>
                <div className="flex gap-2">
                  <button onClick={openPrevious} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all duration-150">
                    🔁 Import from Previous Test
                  </button>
                </div>
              </div>

              <div className={showMetadataGate ? "pointer-events-none blur-sm select-none" : ""}>
              <div
                onPaste={handleScreenshotPaste}
                tabIndex={0}
                className="mb-4 border-2 border-dashed border-brand/30 rounded-xl p-4 text-center bg-brand-light/30 focus:outline-none focus:border-brand/60 cursor-text"
              >
                {extractingScreenshot ? (
                  <p className="text-sm text-brand font-medium">⏳ Reading question from screenshot...</p>
                ) : (
                  <p className="text-sm text-ink-soft">
                    📋 Click here and paste (Ctrl+V) a screenshot — statement &amp; options will auto-fill
                  </p>
                )}
              </div>

              {form.imageUrl && (
                <div className="mb-4 relative inline-block">
                  <img src={form.imageUrl} alt="" className="max-h-48 rounded-lg border" />
                  <button onClick={() => setForm({ ...form, imageUrl: null })} className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs hover:scale-110 active:scale-90 transition-transform duration-150">
                    ✕
                  </button>
                </div>
              )}
              {!form.imageUrl && (
                <div className="mb-4">
                  <label className="text-xs text-slate-500">Shared diagram/image (used in both languages)</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="text-xs block mt-1" />
                </div>
              )}

              {form.enableHi !== form.enableEn ? (
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={handleAutoTranslate}
                    disabled={autoTranslating}
                    className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 active:scale-95 transition-all duration-150"
                  >
                    {autoTranslating ? "Translating..." : `🌐 Auto-Translate to ${form.enableHi ? "English" : "Hindi"}`}
                  </button>
                </div>
              ) : form.enableHi && form.enableEn ? (
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCheckTranslation}
                      disabled={checkingTranslation}
                      className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 active:scale-95 transition-all duration-150"
                    >
                      {checkingTranslation ? "Checking..." : "🔍 AI Check Hindi Translation"}
                    </button>
                    {translationCheck && (
                      <span
                        className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                          translationCheck.verdict === "ACCURATE"
                            ? "bg-green-100 text-success"
                            : translationCheck.verdict === "PARTIALLY_ACCURATE"
                            ? "bg-amber-100 text-warning"
                            : "bg-red-100 text-danger"
                        }`}
                      >
                        {translationCheck.verdict.replace("_", " ")}
                        {translationCheck.issues ? ` — ${translationCheck.issues}` : ""}
                      </span>
                    )}
                  </div>
                  {translationCheck?.improvedHindiStatement && (
                    <button
                      onClick={applyImprovedHindi}
                      className="text-xs text-brand underline self-start hover:opacity-70 transition-opacity duration-150"
                    >
                      ✓ Apply AI's improved Hindi (NCERT terminology)
                    </button>
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
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${lang === "hi" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                            {lang === "hi" ? "हिंदी" : "English"}
                          </span>
                        </div>
                        <div className="card">
                          <FormulaEditor
                            value={langData.statement}
                            onChange={(v) => updateStatementFor(lang, v)}
                            rows={3}
                            placeholder={lang === "hi" ? "प्रश्न यहाँ लिखें..." : "Enter question statement..."}
                          />
                        </div>

                        {isIntegerType ? (
                          <div className="card max-w-xs">
                            <label className="label text-xs">Correct Value</label>
                            <input
                              className="input font-mono"
                              value={langData.correctOptionIds[0] || ""}
                              onChange={(e) => updateCorrectValueFor(lang, e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {langData.options.map((opt, idx) => {
                              const isCorrect = langData.correctOptionIds.includes(opt.id);
                              return (
                                <div key={opt.id} className={`card relative transition-all duration-150 ${isCorrect ? "border-2 border-success" : ""}`}>
                                  <div className="flex items-start gap-2">
                                    <button
                                      onClick={() => toggleCorrectFor(lang, opt.id)}
                                      className={`w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0 flex items-center justify-center active:scale-90 transition-all duration-150 ${
                                        isCorrect ? "bg-success text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      {opt.id}
                                    </button>
                                    <div className="flex-1">
                                      <FormulaEditor
                                        value={opt.text}
                                        onChange={(v) => updateOptionFor(lang, idx, v)}
                                        rows={1}
                                        compact
                                        placeholder={`Option ${opt.id}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="card">
                          <label className="label text-xs font-medium text-slate-700">
                            💡 Solution ({lang === "hi" ? "हिंदी" : "English"}) <span className="text-danger">*</span>
                          </label>
                          <FormulaEditor
                            value={langData.solution}
                            onChange={(v) => setForm({ ...form, [lang]: { ...form[lang], solution: v } })}
                            rows={2}
                            placeholder="Required — explain the correct approach..."
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAiSolve}
                  disabled={aiSolving}
                  className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 active:scale-95 transition-all duration-150 whitespace-nowrap"
                >
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
                <button
                  type="button"
                  onClick={() => solutionImageInputRef.current?.click()}
                  disabled={extractingSolutionImage}
                  className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 active:scale-95 transition-all duration-150 whitespace-nowrap"
                >
                  {extractingSolutionImage ? "Reading image..." : "📷 Upload Solution Image"}
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
              {aiError && <p className="text-xs text-danger mb-2">{aiError}</p>}
              {aiResult && (
                <div className={`text-xs rounded-lg px-3 py-2 mb-4 ${aiResult.confidence === "low" ? "bg-amber-50 text-warning" : "bg-purple-50 text-purple-700"}`}>
                  AI confidence: <strong>{aiResult.confidence}</strong>
                  {aiResult.correctOptionId && (
                    <>
                      {" "}
                      · AI suggests answer <strong>{aiResult.correctOptionId}</strong>
                      {form.en.correctOptionIds[0] !== aiResult.correctOptionId && (
                        <>
                          {" "}
                          (you marked <strong>{form.en.correctOptionIds[0] || form.hi.correctOptionIds[0] || "none"}</strong> —{" "}
                          <button type="button" onClick={applyAiAnswer} className="underline font-medium">
                            use AI's answer
                          </button>
                          )
                        </>
                      )}
                    </>
                  )}
                  <div className="mt-1 text-slate-500">⚠️ AI can make mistakes — always verify before publishing.</div>
                </div>
              )}
              </div>
            </>
          )}
        </div>

        {/* Bottom nav */}
        {!showChoiceScreen && slotChoice !== "import" && (
        <div className="bg-white border-t px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <button
            onClick={() => guardedNavigate(() => goToSlot(activeSection, Math.max(1, activeSlot - 1)))}
            disabled={activeSlot <= 1 || showMetadataGate}
            className="btn-secondary text-xs sm:text-sm disabled:opacity-40 order-1"
          >
            ← Prev
          </button>
          <span className="text-xs sm:text-sm text-slate-500 order-3 sm:order-2 w-full sm:w-auto text-center sm:text-left">
            Question {activeSlot} / {activeSection.targetCount}
          </span>
          <div className="hidden sm:flex items-center gap-2 order-4">
            <span className="text-xs text-slate-400">Jump to</span>
            <input
              type="number"
              min={1}
              max={activeSection.targetCount}
              disabled={showMetadataGate}
              placeholder="#"
              className="w-14 text-sm border border-slate-200 rounded-lg px-2 py-1 text-center disabled:opacity-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Number((e.target as HTMLInputElement).value);
                  if (n >= 1 && n <= activeSection.targetCount) {
                    guardedNavigate(() => goToSlot(activeSection, n));
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
            <button
              onClick={() => guardedNavigate(() => goToSlot(activeSection, Math.min(activeSection.targetCount, activeSlot + 1)))}
              disabled={activeSlot >= activeSection.targetCount || showMetadataGate}
              className="btn-secondary text-xs sm:text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Mandatory Metadata Popup — gates a brand-new question slot until
          Chapter/Topic/Sub Topic/Type/Difficulty/PYQ are all confirmed. */}
      {showMetadataGate && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-1">Question Metadata</h3>
            <p className="text-xs text-slate-500 mb-4">
              Complete this before the question editor opens — Section: <strong>{activeSection.name}</strong> ({activeSection.subject})
            </p>

            <label className="label text-xs">Chapter *</label>
            <select
              className="input mb-3"
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value, topic: "", subTopic: "" })}
            >
              <option value="">Select chapter...</option>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="label text-xs">Topic *</label>
            <div className="mb-3">
              <Combobox
                value={form.topic}
                onChange={(v) => setForm({ ...form, topic: v, subTopic: "" })}
                options={topics}
                disabled={!form.chapter}
                placeholder={form.chapter ? "Select or type a topic..." : "Select chapter first"}
              />
            </div>

            <label className="label text-xs">Sub Topic (optional)</label>
            <input
              className="input mb-3"
              list="gate-subtopic-options"
              value={form.subTopic}
              disabled={!form.topic}
              onChange={(e) => setForm({ ...form, subTopic: e.target.value })}
              placeholder={form.topic ? "E.g. Terminal Velocity" : "Select topic first"}
            />
            <datalist id="gate-subtopic-options">
              {subTopicSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>

            <label className="label text-xs">Question Type</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`text-xs px-3 py-2 rounded-lg border transition-all duration-150 active:scale-95 ${form.type === t.value ? "bg-brand text-white border-brand shadow-sm" : "border-slate-200 text-slate-600 hover:border-brand/40"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="label text-xs">Difficulty</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {["EASY", "MEDIUM", "HARD"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: d })}
                  className={`text-xs px-3 py-2 rounded-lg border capitalize transition-all duration-150 active:scale-95 ${form.difficulty === d ? "bg-brand text-white border-brand shadow-sm" : "border-slate-200 text-slate-600 hover:border-brand/40"}`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-700">Is this a PYQ?</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: "PRACTICE", pyqSource: "" })}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all duration-150 active:scale-95 ${form.category !== "PYQ" ? "bg-brand text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: "PYQ" })}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all duration-150 active:scale-95 ${form.category === "PYQ" ? "bg-brand text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  Yes
                </button>
              </div>
            </label>
            {form.category === "PYQ" && (
              <input
                className="input mb-3"
                placeholder="e.g. NEET 2026"
                value={form.pyqSource}
                onChange={(e) => setForm({ ...form, pyqSource: e.target.value })}
              />
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSlotChoice("none")}
                className="btn-secondary text-sm flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setMetadataConfirmed(true)}
                disabled={!canContinueMetadata}
                className="btn-primary text-sm flex-1 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="w-full sm:w-96 bg-white h-full p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Question Metadata</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 active:scale-90 transition-all duration-150">✕</button>
            </div>

            <label className="label text-xs">Subject</label>
            <div className="input bg-slate-50 text-slate-500 mb-4">{activeSection.subject}</div>

            <label className="label text-xs">Chapter</label>
            <select className="input mb-4" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value, topic: "", subTopic: "" })}>
              <option value="">Select chapter...</option>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="label text-xs">Topic</label>
            <div className="mb-4">
              <Combobox value={form.topic} onChange={(v) => setForm({ ...form, topic: v, subTopic: "" })} options={topics} placeholder="Select or type a topic..." />
            </div>

            <label className="label text-xs">Sub Topic</label>
            <input
              className="input mb-4"
              list="subtopic-options"
              value={form.subTopic}
              onChange={(e) => setForm({ ...form, subTopic: e.target.value })}
              placeholder="E.g. Terminal Velocity"
              disabled={!form.topic}
            />
            <datalist id="subtopic-options">
              {subTopicSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>

            <label className="label text-xs">Question Type</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`text-xs px-3 py-2 rounded-lg border transition-all duration-150 active:scale-95 ${form.type === t.value ? "bg-brand text-white border-brand shadow-sm" : "border-slate-200 text-slate-600 hover:border-brand/40"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="label text-xs">Difficulty</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["EASY", "MEDIUM", "HARD"].map((d) => (
                <button
                  key={d}
                  onClick={() => setForm({ ...form, difficulty: d })}
                  className={`text-xs px-3 py-2 rounded-lg border capitalize transition-all duration-150 active:scale-95 ${form.difficulty === d ? "bg-brand text-white border-brand shadow-sm" : "border-slate-200 text-slate-600 hover:border-brand/40"}`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label text-xs">+ Marks (override)</label>
                <input className="input" placeholder={String(test.correctMarks)} value={form.marksOverride} onChange={(e) => setForm({ ...form, marksOverride: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs">− Marks (override)</label>
                <input className="input" placeholder={String(test.incorrectMarks)} value={form.negativeMarksOverride} onChange={(e) => setForm({ ...form, negativeMarksOverride: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-700">Is PYQ?</span>
              <input
                type="checkbox"
                checked={form.category === "PYQ"}
                onChange={(e) => setForm({ ...form, category: e.target.checked ? "PYQ" : "PRACTICE" })}
              />
            </label>
            {form.category === "PYQ" && (
              <input
                className="input mb-4"
                placeholder="e.g. NEET 2026"
                value={form.pyqSource}
                onChange={(e) => setForm({ ...form, pyqSource: e.target.value })}
              />
            )}

            <button onClick={() => setDrawerOpen(false)} className="btn-primary w-full">
              Apply Metadata
            </button>
          </div>
        </div>
      )}

      {/* Unsaved-changes navigation guard modal */}
      {pendingNav && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="card max-w-sm text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="font-semibold text-slate-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-slate-500 mb-4">Save your changes before navigating, or discard them.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setPendingNav(null)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={discardChanges} className="bg-danger text-white px-4 py-2 rounded-lg text-sm shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-150">Discard</button>
              <button onClick={handleSave} className="btn-primary text-sm">Save First</button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Previous Test modal */}
      {importMode === "previous" && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6">
          <div className="card w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Import from Previous Test</h3>
              <button onClick={() => setImportMode("none")} className="text-slate-400 hover:text-slate-600 active:scale-90 transition-all duration-150">✕</button>
            </div>
            <select
              className="input"
              onChange={async (e) => {
                if (!e.target.value || !activeSection) return;
                const res = await fetch(`/api/tests/${e.target.value}`);
                const t: TestData = await res.json();
                const matchingSections =
                  activeSection.subject === "Biology"
                    ? t.sections.filter((s) => s.subject === "Biology" || s.subject === "Botany" || s.subject === "Zoology")
                    : t.sections.filter((s) => s.subject === activeSection.subject);
                if (matchingSections.length === 0) return;
                for (const matchingSection of matchingSections) {
                  for (const sq of matchingSection.questions) {
                    await fetch(`/api/sections/${activeSection.id}/questions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ questionId: sq.questionId }),
                    });
                  }
                }
                setImportMode("none");
                const fresh = await loadTest();
                const freshSection = fresh.sections.find((s) => s.id === activeSection.id);
                if (freshSection) goToSlot(freshSection, freshSection.questions.length);
              }}
            >
              <option value="">Select a test...</option>
              {prevTests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
