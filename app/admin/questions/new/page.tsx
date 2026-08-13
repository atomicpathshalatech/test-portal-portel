"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FormulaEditor from "@/components/FormulaEditor";
import FormulaText from "@/components/FormulaText";
import Combobox from "@/components/Combobox";
import { SYLLABUS, resolveBiologySubject } from "@/lib/syllabusData";

type OptionRow = { id: string; text: string };
type LangContent = { statement: string; options: OptionRow[]; correctOptionIds: string[]; solution: string };

const emptyLang = (): LangContent => ({
  statement: "",
  options: [
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ],
  correctOptionIds: [],
  solution: "",
});

const emptyIntegerLang = (): LangContent => ({
  statement: "",
  options: [],
  correctOptionIds: [""],
  solution: "",
});

const QUESTION_TYPES = [
  { value: "SINGLE_CORRECT", label: "Single Correct" },
  { value: "MULTIPLE_CORRECT", label: "Multiple Correct" },
  { value: "STATEMENT_BASED", label: "Statement Based" },
  { value: "MATCH_COLUMN", label: "Match the Column" },
  { value: "ASSERTION_REASON", label: "Assertion Reason" },
  { value: "INTEGER", label: "Integer Type" },
  { value: "NUMERICAL", label: "Numerical" },
];

export default function NewQuestionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("sectionId");
  const sectionSubject = searchParams.get("subject");
  const prefillChapter = searchParams.get("chapter");
  const editId = searchParams.get("edit");
  const [loadingExisting, setLoadingExisting] = useState(!!editId);

  const [meta, setMeta] = useState({
    subject: sectionSubject || "Physics",
    chapter: prefillChapter || "",
    topic: "",
    subTopic: "",
    type: "SINGLE_CORRECT",
    difficulty: "MEDIUM",
    category: "PRACTICE",
    pyqSource: "",
  });
  const [subTopicSuggestions, setSubTopicSuggestions] = useState<string[]>([]);
  const [pyqCustom, setPyqCustom] = useState(false);
  const [topicCustom, setTopicCustom] = useState(false);
  const [aiSolving, setAiSolving] = useState(false);
  const [aiResult, setAiResult] = useState<{ hi: { correctOptionId: string | null; confidence: string } | null; en: { correctOptionId: string | null; confidence: string } | null }>({ hi: null, en: null });
  const [aiError, setAiError] = useState("");
  const [justSavedCode, setJustSavedCode] = useState<string | null>(null);
  const [pyqOptions, setPyqOptions] = useState<string[]>([]);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [lockedSubject, setLockedSubject] = useState<string | null>(null);
  const [enableHi, setEnableHi] = useState(true);
  const [enableEn, setEnableEn] = useState(true);
  const isIntegerType = meta.type === "INTEGER" || meta.type === "NUMERICAL";
  const [hi, setHi] = useState<LangContent>(emptyLang());
  const [en, setEn] = useState<LangContent>(emptyLang());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [extractingScreenshot, setExtractingScreenshot] = useState(false);
  // Automatic bilingual sync: when one language's statement is filled and
  // the other is empty, translate across; when a language has an answer-less
  // statement+options, auto-suggest the correct option via AI. Admins can
  // always overwrite anything these produce — they're starting points, not
  // final answers.
  const [autoTranslating, setAutoTranslating] = useState(false);
  const [autoSolving, setAutoSolving] = useState<{ hi: boolean; en: boolean }>({ hi: false, en: false });
  const [aiSuggested, setAiSuggested] = useState<{ hi: boolean; en: boolean }>({ hi: false, en: false });
  const [isPublishedQuestion, setIsPublishedQuestion] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/questions/${editId}`)
      .then((r) => r.json())
      .then((q) => {
        setMeta({
          subject: q.subject,
          chapter: q.chapter || "",
          topic: q.topic || "",
          subTopic: q.subTopic || "",
          type: q.type,
          difficulty: q.difficulty,
          category: q.category || "PRACTICE",
          pyqSource: q.pyqSource || "",
        });
        if (q.category === "PYQ" && q.pyqSource) setPyqCustom(true);
        if (q.topic && q.chapter && !(SYLLABUS[q.subject]?.[q.chapter] || []).includes(q.topic)) {
          setTopicCustom(true);
        }
        setImageUrl(q.imageUrl || null);

        const hiT = q.translations.find((t: any) => t.language === "hi");
        const enT = q.translations.find((t: any) => t.language === "en");
        setEnableHi(!!hiT);
        setEnableEn(!!enT);
        if (hiT) setHi({ statement: hiT.statement, options: hiT.options, correctOptionIds: hiT.correctOptionIds, solution: hiT.solution || "" });
        if (enT) setEn({ statement: enT.statement, options: enT.options, correctOptionIds: enT.correctOptionIds, solution: enT.solution || "" });
        setIsPublishedQuestion(!!q.isPublished);
        setLoadingExisting(false);
      });
  }, [editId]);

  useEffect(() => {
    if (!meta.topic) {
      setSubTopicSuggestions([]);
      return;
    }
    fetch(`/api/subtopics?topic=${encodeURIComponent(meta.topic)}`)
      .then((r) => r.json())
      .then(setSubTopicSuggestions);
  }, [meta.topic]);

  useEffect(() => {
    fetch("/api/pyq-sources")
      .then((r) => r.json())
      .then(setPyqOptions);
  }, []);

  useEffect(() => {
    if (sectionSubject) {
      setLockedSubject(sectionSubject);
      setMeta((m) => ({ ...m, subject: sectionSubject }));
    }
  }, [sectionSubject]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role === "TEACHER" && d.subject && !sectionSubject) {
          setLockedSubject(d.subject);
          setMeta((m) => ({ ...m, subject: d.subject }));
        }
      });
  }, []);

  // Switch between the 4-option layout and the single-answer-value layout
  // when the question type changes between INTEGER/NUMERICAL and everything else.
  useEffect(() => {
    if (isIntegerType) {
      if (hi.options.length !== 0) setHi({ ...emptyIntegerLang(), statement: hi.statement, solution: hi.solution });
      if (en.options.length !== 0) setEn({ ...emptyIntegerLang(), statement: en.statement, solution: en.solution });
    } else {
      if (hi.options.length === 0) setHi({ ...emptyLang(), statement: hi.statement, solution: hi.solution });
      if (en.options.length === 0) setEn({ ...emptyLang(), statement: en.statement, solution: en.solution });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntegerType]);

  const chapters = Object.keys(SYLLABUS[meta.subject] || {});
  const topics = meta.chapter ? SYLLABUS[meta.subject]?.[meta.chapter] || [] : [];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploadingImage(false);
    if (!res.ok) {
      setError(data.message || "Image upload failed");
      return;
    }
    setImageUrl(data.url);
    e.target.value = "";
  }

  // Paste a screenshot (Ctrl+V) of a question and have AI extract the
  // statement/options into the form — same feature as the test/DPP question
  // builders, wired to this page's separate hi/en state instead of a single
  // combined form object.
  async function handleScreenshotPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
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

      if (data.isIntegerType) {
        setMeta((m) => ({ ...m, type: "INTEGER" }));
      }
      if (data.statement_en) {
        setEn({
          statement: data.statement_en,
          options: data.isIntegerType ? [] : data.options_en || en.options,
          correctOptionIds: data.isIntegerType ? [""] : [],
          solution: en.solution,
        });
        setEnableEn(true);
      }
      if (data.statement_hi) {
        setHi({
          statement: data.statement_hi,
          options: data.isIntegerType ? [] : data.options_hi || hi.options,
          correctOptionIds: data.isIntegerType ? [""] : [],
          solution: hi.solution,
        });
        setEnableHi(true);
      }
      if (data.hasImage) {
        setAiError(
          "⚠️ This screenshot appears to contain a diagram/figure — text was extracted, but please upload that image separately using the field below."
        );
      }
    } finally {
      setExtractingScreenshot(false);
    }
  }

  function updateOptionFor(lang: "hi" | "en", idx: number, text: string) {
    const setter = lang === "hi" ? setHi : setEn;
    const content = lang === "hi" ? hi : en;
    const options = [...content.options];
    options[idx] = { ...options[idx], text };
    setter({ ...content, options });
  }

  function toggleCorrectFor(lang: "hi" | "en", optionId: string) {
    const isMulti = meta.type === "MULTIPLE_CORRECT";
    const setter = lang === "hi" ? setHi : setEn;
    const content = lang === "hi" ? hi : en;
    let ids = content.correctOptionIds;
    if (isMulti) {
      ids = ids.includes(optionId) ? ids.filter((i) => i !== optionId) : [...ids, optionId];
    } else {
      ids = [optionId];
    }
    setter({ ...content, correctOptionIds: ids });
    setAiSuggested((s) => ({ ...s, [lang]: false }));
  }

  async function handleSubmit(e: React.FormEvent, exitAfter = false) {
    e.preventDefault();
    setError("");
    if (!enableHi && !enableEn) {
      setError("Enable at least one language");
      return;
    }
    if (!meta.chapter) {
      setError("Chapter is required.");
      return;
    }
    if (!meta.topic) {
      setError("Topic is required.");
      return;
    }
    const langChecks: { label: string; enabled: boolean; data: LangContent }[] = [
      { label: "Hindi", enabled: enableHi, data: hi },
      { label: "English", enabled: enableEn, data: en },
    ];
    for (const l of langChecks) {
      if (!l.enabled) continue;
      if (!l.data.statement || !l.data.statement.trim()) {
        setError(`${l.label} statement is required.`);
        return;
      }
      if (!l.data.solution || !l.data.solution.trim()) {
        setError(`${l.label} solution is required — every enabled language needs its own explanation.`);
        return;
      }
      if (isIntegerType) {
        if (!l.data.correctOptionIds[0] || !String(l.data.correctOptionIds[0]).trim()) {
          setError(`${l.label}: enter the correct value.`);
          return;
        }
      } else {
        const emptyOption = l.data.options.find((o) => !o.text || !o.text.trim());
        if (emptyOption) {
          setError(`${l.label}: Option ${emptyOption.id} cannot be empty.`);
          return;
        }
        if (l.data.correctOptionIds.length === 0) {
          setError(`${l.label}: select the correct option.`);
          return;
        }
      }
    }
    setLoading(true);
    const translations: any = {};
    if (enableHi) translations.hi = hi;
    if (enableEn) translations.en = en;

    // "Biology" is only a section-level convenience label (see
    // lib/syllabusData.ts) — the Question row itself must always save under
    // its real subject (Botany/Zoology) so Question Bank browsing, DPPs,
    // and Teacher subject permissions keep working unchanged.
    const payloadMeta = { ...meta, subject: resolveBiologySubject(meta.subject, meta.chapter) };

    if (editId) {
      const res = await fetch(`/api/questions/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadMeta, translations, imageUrl, reason: editReason }),
      });
      setLoading(false);
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update question");
        return;
      }
      router.push(backLink());
      return;
    }

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payloadMeta, translations, imageUrl }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to create question");
      return;
    }
    const created = await res.json();

    const dppId = searchParams.get("dppId");
    const testId = searchParams.get("testId");

    if (dppId || sectionId) {
      const linkUrl = dppId ? `/api/dpps/${dppId}/questions` : `/api/sections/${sectionId}/questions`;
      const linkRes = await fetch(linkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: created.id }),
      });
      if (!linkRes.ok) {
        const d = await linkRes.json().catch(() => ({}));
        setError(d.message || "Question was created but couldn't be linked — it's still safely saved in the Question Bank.");
        return;
      }

      if (exitAfter) {
        router.push(dppId ? `/admin/dpps/${dppId}/add-questions` : testId ? `/admin/tests/${testId}/add-questions` : "/admin/questions");
        return;
      }

      // Save & Next — stay in place with a fresh blank editor. Chapter/topic/
      // subject/difficulty carry over since consecutive questions in one
      // sitting are usually from the same chapter; content resets.
      setJustSavedCode(created.questionCode);
      setHi(isIntegerType ? emptyIntegerLang() : emptyLang());
      setEn(isIntegerType ? emptyIntegerLang() : emptyLang());
      setImageUrl(null);
      setAiResult({ hi: null, en: null });
      setAiSuggested({ hi: false, en: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setJustSavedCode(null), 4000);
      return;
    }

    // "Biology" was resolved to the question's real subject for saving, but
    // `meta` still holds "Biology" — update it too so the success screen's
    // "Done"/"Add Another" buttons (which use meta.subject/backLink) point
    // to a real, browsable Question Bank subject instead of a dead route.
    if (meta.subject === "Biology") {
      setMeta((m) => ({ ...m, subject: payloadMeta.subject }));
    }
    setCreatedCode(created.questionCode);
  }

  function backLink() {
    if (meta.chapter) return `/admin/questions/${encodeURIComponent(meta.subject)}/${encodeURIComponent(meta.chapter)}`;
    return `/admin/questions/${encodeURIComponent(meta.subject)}`;
  }

  async function handleAiSolveFor(lang: "hi" | "en") {
    const content = lang === "hi" ? hi : en;
    const setter = lang === "hi" ? setHi : setEn;
    if (!content.statement.trim()) {
      setAiError("Write the question statement first.");
      return;
    }
    setAiSolving(true);
    setAiError("");
    setAiResult((prev) => ({ ...prev, [lang]: null }));
    const res = await fetch("/api/ai/solve-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: meta.subject,
        chapter: meta.chapter,
        topic: meta.topic,
        statement: content.statement,
        options: content.options,
        language: lang,
        questionType: meta.type,
      }),
    });
    const data = await res.json();
    setAiSolving(false);
    if (!res.ok) {
      setAiError(data.message || "AI solve failed");
      return;
    }
    setter({ ...content, solution: data.solution || "" });
    setAiResult((prev) => ({ ...prev, [lang]: { correctOptionId: data.correctOptionId, confidence: data.confidence } }));
  }

  function applyAiAnswerFor(lang: "hi" | "en") {
    const result = aiResult[lang];
    if (!result?.correctOptionId) return;
    const setter = lang === "hi" ? setHi : setEn;
    const content = lang === "hi" ? hi : en;
    setter({ ...content, correctOptionIds: [result.correctOptionId] });
    setAiSuggested((s) => ({ ...s, [lang]: true }));
  }

  // ---- Automatic bilingual sync ----
  // Debounce key: join statement + option texts into one string so the
  // effect re-fires as the admin keeps typing/pasting, without re-running on
  // every keystroke (real API calls only fire ~1.5s after typing stops).
  const enKey = `${en.statement}|${en.options.map((o) => o.text).join("|")}`;
  const hiKey = `${hi.statement}|${hi.options.map((o) => o.text).join("|")}`;

  // 1) Translate: when one enabled language has a statement and the other
  // (also enabled) is empty, auto-translate statement + options + solution
  // across — same endpoint/NCERT-terminology behavior the Test/DPP builders
  // already use, just triggered automatically instead of by a button.
  useEffect(() => {
    if (loadingExisting || autoTranslating) return;
    const timer = setTimeout(async () => {
      let sourceLang: "hi" | "en" | null = null;
      if (enableEn && en.statement.trim() && enableHi && !hi.statement.trim()) sourceLang = "en";
      else if (enableHi && hi.statement.trim() && enableEn && !en.statement.trim()) sourceLang = "hi";
      if (!sourceLang) return;

      const source = sourceLang === "hi" ? hi : en;
      const targetLang = sourceLang === "hi" ? "en" : "hi";
      setAutoTranslating(true);
      try {
        const res = await fetch("/api/ai/translate-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: meta.subject,
            sourceLang,
            statement: source.statement,
            options: isIntegerType ? undefined : source.options,
            solution: source.solution,
            isIntegerType,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          const setTarget = targetLang === "hi" ? setHi : setEn;
          setTarget((prev) => ({
            ...prev,
            statement: data.statement || "",
            options: isIntegerType ? prev.options : data.options || prev.options,
            solution: data.solution || prev.solution,
          }));
        }
      } catch {
        // Silent — this is a background convenience, not a blocking action.
        // The admin can still fill the other language in by hand.
      } finally {
        setAutoTranslating(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enKey, hiKey, enableEn, enableHi, loadingExisting]);

  // 2) Also re-sync just the solution when a language's solution is added
  // (typed, pasted, or AI-generated) after both statements already exist —
  // e.g. admin pastes a solution into only the English side later.
  useEffect(() => {
    if (loadingExisting || autoTranslating) return;
    const timer = setTimeout(async () => {
      const bothStatementsExist = enableEn && en.statement.trim() && enableHi && hi.statement.trim();
      if (!bothStatementsExist) return;
      let sourceLang: "hi" | "en" | null = null;
      if (en.solution.trim() && !hi.solution.trim()) sourceLang = "en";
      else if (hi.solution.trim() && !en.solution.trim()) sourceLang = "hi";
      if (!sourceLang) return;

      const source = sourceLang === "hi" ? hi : en;
      const targetLang = sourceLang === "hi" ? "en" : "hi";
      setAutoTranslating(true);
      try {
        const res = await fetch("/api/ai/translate-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: meta.subject,
            sourceLang,
            statement: source.statement,
            options: isIntegerType ? undefined : source.options,
            solution: source.solution,
            isIntegerType,
          }),
        });
        const data = await res.json();
        if (res.ok && data.solution) {
          const setTarget = targetLang === "hi" ? setHi : setEn;
          setTarget((prev) => (prev.solution.trim() ? prev : { ...prev, solution: data.solution }));
        }
      } catch {
        // Silent — background convenience only.
      } finally {
        setAutoTranslating(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en.solution, hi.solution, enableEn, enableHi, loadingExisting]);

  // 3) Auto-suggest the correct option once a language has a statement +
  // options but no answer marked yet. Clearly flagged via `aiSuggested` so
  // the admin knows to double-check it (cleared the moment they click any
  // option themselves). Skipped for Integer/Numerical — the underlying API
  // needs a real options list, which those question types don't have.
  useEffect(() => {
    if (loadingExisting || isIntegerType) return;
    const timer = setTimeout(async () => {
      for (const lang of ["en", "hi"] as const) {
        const enabled = lang === "en" ? enableEn : enableHi;
        const content = lang === "en" ? en : hi;
        const setter = lang === "en" ? setEn : setHi;
        if (!enabled || autoSolving[lang]) continue;
        if (!content.statement.trim() || !content.options.some((o) => o.text.trim())) continue;
        if (content.correctOptionIds.length > 0 && content.correctOptionIds[0]) continue; // already answered

        setAutoSolving((s) => ({ ...s, [lang]: true }));
        try {
          const res = await fetch("/api/ai/solve-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject: meta.subject,
              chapter: meta.chapter,
              topic: meta.topic,
              statement: content.statement,
              options: content.options,
              language: lang,
              questionType: meta.type,
            }),
          });
          const data = await res.json();
          if (res.ok && data.correctOptionId) {
            setter((prev) =>
              prev.correctOptionIds[0] ? prev : { ...prev, correctOptionIds: [data.correctOptionId], solution: prev.solution || data.solution || "" }
            );
            setAiSuggested((s) => ({ ...s, [lang]: true }));
          }
        } catch {
          // Silent — background convenience only.
        } finally {
          setAutoSolving((s) => ({ ...s, [lang]: false }));
        }
      }
    }, 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enKey, hiKey, enableEn, enableHi, loadingExisting, isIntegerType]);

  const dppIdParam = searchParams.get("dppId");
  const testIdParam = searchParams.get("testId");
  function backDestination() {
    if (dppIdParam) return `/admin/dpps/${dppIdParam}/add-questions`;
    if (sectionId) return testIdParam ? `/admin/tests/${testIdParam}/add-questions` : "/admin/questions";
    return backLink();
  }
  function hasUnsavedContent() {
    return !!(hi.statement.trim() || en.statement.trim() || imageUrl);
  }
  function handleBack() {
    if (hasUnsavedContent() && !window.confirm("Discard unsaved changes?")) return;
    router.push(backDestination());
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={handleBack} className="text-sm text-brand hover:opacity-70 transition-opacity duration-150">
          ← Back
        </button>
        {justSavedCode && (
          <span className="text-sm text-success font-medium bg-green-50 px-3 py-1 rounded-full">
            ✓ {justSavedCode} added — ready for the next question
          </span>
        )}
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">{editId ? "Edit Question" : "New Question"}</h1>
      {loadingExisting && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="card">Loading question...</div>
        </div>
      )}
      {sectionId && (
        <div className="bg-brand-light text-brand text-sm rounded-lg px-4 py-2 mb-4">
          This question will be added directly to this section ({sectionSubject}) once saved.
        </div>
      )}
      {isPublishedQuestion && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-2 text-purple-700 text-sm font-medium mb-2">
            <span className="material-symbols-outlined text-base">history</span>
            This question is published — this edit will be permanently recorded in Version History.
          </div>
          <input
            className="input text-sm"
            placeholder="Reason for this edit (e.g. Corrected Option B, Fixed diagram)..."
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
          />
        </div>
      )}
      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="card grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={meta.subject}
              disabled={!!lockedSubject}
              onChange={(e) => setMeta({ ...meta, subject: e.target.value, chapter: "", topic: "" })}
            >
              <option>Physics</option>
              <option>Chemistry</option>
              <option>Biology</option>
              <option>Botany</option>
              <option>Zoology</option>
            </select>
          </div>
          <div>
            <label className="label">Chapter</label>
            <Combobox
              value={meta.chapter}
              onChange={(v) => setMeta({ ...meta, chapter: v, topic: "" })}
              options={chapters}
              placeholder="Select or type a chapter..."
            />
          </div>
          <div>
            <label className="label">Topic</label>
            {!topicCustom ? (
              <select
                className="input"
                value={meta.topic}
                disabled={!meta.chapter}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setTopicCustom(true);
                    setMeta({ ...meta, topic: "" });
                  } else {
                    setMeta({ ...meta, topic: e.target.value });
                  }
                }}
              >
                <option value="">{meta.chapter ? "Select topic..." : "Select chapter first"}</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__" disabled={!meta.chapter}>
                  + Add new topic...
                </option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input"
                  autoFocus
                  placeholder="Type new topic name"
                  value={meta.topic}
                  onChange={(e) => setMeta({ ...meta, topic: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => {
                    setTopicCustom(false);
                    setMeta({ ...meta, topic: "" });
                  }}
                  className="btn-secondary text-sm whitespace-nowrap"
                >
                  Use List
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="label">Sub Topic (optional)</label>
            <input
              className="input"
              list="subtopic-suggestions"
              value={meta.subTopic}
              disabled={!meta.topic}
              onChange={(e) => setMeta({ ...meta, subTopic: e.target.value })}
              placeholder={meta.topic ? "E.g. Terminal Velocity" : "Select topic first"}
            />
            <datalist id="subtopic-suggestions">
              {subTopicSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Question Type</label>
            <select className="input" value={meta.type} onChange={(e) => setMeta({ ...meta, type: e.target.value })}>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input"
              value={meta.difficulty}
              onChange={(e) => setMeta({ ...meta, difficulty: e.target.value })}
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={meta.category}
              onChange={(e) => setMeta({ ...meta, category: e.target.value, pyqSource: "" })}
            >
              <option value="PRACTICE">Practice</option>
              <option value="PYQ">PYQ (Previous Year Question)</option>
              <option value="MODULE">Module</option>
              <option value="ASSIGNMENT">Assignment</option>
            </select>
          </div>
          {meta.category === "PYQ" && (
            <div className="col-span-2">
              <label className="label">PYQ — Source Exam & Year</label>
              {!pyqCustom ? (
                <select
                  className="input"
                  value={meta.pyqSource}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setPyqCustom(true);
                      setMeta({ ...meta, pyqSource: "" });
                    } else {
                      setMeta({ ...meta, pyqSource: e.target.value });
                    }
                  }}
                  required
                >
                  <option value="">Select...</option>
                  {pyqOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  <option value="__custom__">+ Type a custom exam name...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="e.g. NEET 2027, State CET 2025"
                    value={meta.pyqSource}
                    onChange={(e) => setMeta({ ...meta, pyqSource: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPyqCustom(false);
                      setMeta({ ...meta, pyqSource: "" });
                    }}
                    className="btn-secondary text-sm whitespace-nowrap"
                  >
                    Use List
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          onPaste={handleScreenshotPaste}
          tabIndex={0}
          className="card border-2 border-dashed border-brand/30 text-center bg-brand-light/30 transition-colors duration-150 focus:outline-none focus:border-brand/60 cursor-text"
        >
          {extractingScreenshot ? (
            <p className="text-sm text-brand font-medium">⏳ Reading question from screenshot...</p>
          ) : (
            <p className="text-sm text-ink-soft">
              📋 Click here and paste (Ctrl+V) a screenshot — statement &amp; options will auto-fill
            </p>
          )}
        </div>

        <div className="card">
          <label className="label">Question Image / Diagram (optional, shared across languages)</label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Question diagram" className="max-h-48 rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs font-bold hover:scale-110 active:scale-90 transition-transform duration-150"
              >
                ✕
              </button>
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="text-sm"
              />
              {uploadingImage && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
              <p className="text-xs text-slate-400 mt-1">
                PNG, JPEG, WEBP or SVG · max 4MB. Or paste an image directly into the statement/option/solution boxes below.
              </p>
            </div>
          )}
        </div>

        {/* Side-by-side bilingual editor — same layout used everywhere a
            question is authored (Question Bank, Test, DPP), matching the
            interaction language teachers already know. */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enableHi} onChange={(e) => setEnableHi(e.target.checked)} />
            हिंदी (Hindi)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enableEn} onChange={(e) => setEnableEn(e.target.checked)} />
            English
          </label>
          {autoTranslating && (
            <span className="text-xs text-brand flex items-center gap-1">
              <span className="animate-pulse">🌐</span> Auto-translating...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["hi", "en"] as const).map((lang) => {
            const enabled = lang === "hi" ? enableHi : enableEn;
            if (!enabled) return null;
            const content = lang === "hi" ? hi : en;
            const setter = lang === "hi" ? setHi : setEn;
            const result = aiResult[lang];
            return (
              <div key={lang} className="card">
                <div className="text-sm font-semibold text-brand mb-2">{lang === "hi" ? "हिंदी" : "English"}</div>

                <label className="label">Statement</label>
                <FormulaEditor
                  value={content.statement}
                  onChange={(v) => setter({ ...content, statement: v })}
                  rows={3}
                  placeholder={lang === "hi" ? "प्रश्न यहाँ लिखें..." : "Enter question statement..."}
                />

                {isIntegerType ? (
                  <>
                    <label className="label mt-4">Correct {meta.type === "INTEGER" ? "Integer" : "Numerical"} Value</label>
                    <input
                      className="input font-mono text-sm max-w-xs"
                      value={content.correctOptionIds[0] || ""}
                      onChange={(e) => setter({ ...content, correctOptionIds: [e.target.value] })}
                      placeholder={meta.type === "INTEGER" ? "e.g. 42" : "e.g. 9.8"}
                    />
                  </>
                ) : (
                  <>
                    <label className="label mt-4 flex items-center gap-2 flex-wrap">
                      Options — click ✓ to mark correct
                      {autoSolving[lang] && (
                        <span className="text-xs text-brand font-normal flex items-center gap-1">
                          <span className="animate-pulse">🤖</span> AI thinking...
                        </span>
                      )}
                      {!autoSolving[lang] && aiSuggested[lang] && content.correctOptionIds[0] && (
                        <span className="text-xs text-warning font-normal">🤖 AI-suggested — verify</span>
                      )}
                    </label>
                    <div className="space-y-2">
                      {content.options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCorrectFor(lang, opt.id)}
                            className={`w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 mt-0 active:scale-90 transition-all duration-150 ${
                              content.correctOptionIds.includes(opt.id)
                                ? "bg-success text-white shadow-sm"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                      ))}
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between mb-2 mt-5">
                  <label className="label mb-0">
                    Solution ({lang === "hi" ? "हिंदी" : "English"}) <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAiSolveFor(lang)}
                    disabled={aiSolving}
                    className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 active:scale-95 transition-all duration-150 whitespace-nowrap"
                  >
                    {aiSolving ? "Thinking..." : "✨ Solve with AI"}
                  </button>
                </div>
                {result && (
                  <div className={`text-xs rounded-lg px-3 py-2 mb-2 ${result.confidence === "low" ? "bg-amber-50 text-warning" : "bg-purple-50 text-purple-700"}`}>
                    AI confidence: <strong>{result.confidence}</strong>
                    {result.correctOptionId && (
                      <>
                        {" "}
                        · AI thinks <strong>{result.correctOptionId}</strong>
                        {content.correctOptionIds[0] !== result.correctOptionId && (
                          <>
                            {" "}
                            (you marked <strong>{content.correctOptionIds[0] || "none"}</strong> —{" "}
                            <button type="button" onClick={() => applyAiAnswerFor(lang)} className="underline font-medium">
                              use AI's answer
                            </button>
                            )
                          </>
                        )}
                      </>
                    )}
                    <div className="mt-1 text-slate-500">⚠️ Always verify before publishing.</div>
                  </div>
                )}
                <FormulaEditor
                  value={content.solution}
                  onChange={(v) => setter({ ...content, solution: v })}
                  rows={3}
                  placeholder="Required — explain the correct approach..."
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={loading || uploadingImage}>
            {loading ? "Saving..." : editId ? "Update Question" : sectionId || dppIdParam ? "Save & Next" : "Save Question"}
          </button>
          {!editId && (sectionId || dppIdParam) && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e as any, true)}
              disabled={loading || uploadingImage}
              className="btn-secondary"
            >
              Save & Exit
            </button>
          )}
        </div>
      </form>

      {createdCode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="card max-w-sm text-center">
            <div className="text-3xl mb-2">✅</div>
            <h2 className="font-semibold text-slate-900 mb-1">Question Saved</h2>
            <p className="text-sm text-slate-500 mb-3">Its permanent Question ID is:</p>
            <div className="text-2xl font-mono font-bold text-brand bg-brand-light rounded-lg py-2 mb-4">
              {createdCode}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Use this ID to instantly import this question into any test later.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setCreatedCode(null);
                  setHi(isIntegerType ? emptyIntegerLang() : emptyLang());
                  setEn(isIntegerType ? emptyIntegerLang() : emptyLang());
                  setImageUrl(null);
                }}
                className="btn-secondary text-sm"
              >
                Add Another
              </button>
              <button onClick={() => router.push(backLink())} className="btn-primary text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
