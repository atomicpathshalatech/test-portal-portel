"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FormulaEditor from "@/components/FormulaEditor";
import FormulaText from "@/components/FormulaText";
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
  topic: string | null;
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
    topic: dpp.topic || "",
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
  }, [dpp, slot]);

  const isDirty = form ? JSON.stringify(form) !== savedSnapshot : false;
  const isIntegerType = form?.type === "INTEGER" || form?.type === "NUMERICAL";

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

  if (loading || !dpp) return <div className="text-center text-slate-400 py-10">Loading...</div>;
  if (!form) return null;

  const added = dpp.questions.length;
  const target = dpp.questionTargetCount;
  const chapters = Object.keys(SYLLABUS[dpp.subject] || {});
  const topics = form.chapter ? SYLLABUS[dpp.subject]?.[form.chapter] || [] : [];
  const isNewSlot = !form.existingQuestionId;

  return (
    <div className="fixed inset-0 flex flex-col bg-panel z-[100]">
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/dpps" className="text-sm text-brand">← DPPs</Link>
          <span className="font-semibold text-slate-800">{dpp.name}</span>
          <span className="text-xs font-mono text-brand">{dpp.code}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dpp.status === "PUBLISHED" ? "bg-green-100 text-success" : "bg-slate-100 text-slate-600"}`}>
            {dpp.status}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{added}/{target} questions</span>
          {dpp.status === "DRAFT" && (
            <button
              onClick={async () => {
                await fetch(`/api/dpps/${dppId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PUBLISHED" }) });
                loadDpp();
              }}
              disabled={added < target}
              title={added < target ? "Add all questions first" : ""}
              className="btn-primary text-sm disabled:opacity-40"
            >
              Publish DPP
            </button>
          )}
          <button onClick={() => setDrawerOpen(true)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600 text-lg">tune</span>
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="bg-amber-500 text-white text-sm px-6 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-sm">warning</span>
          You have unsaved changes. Save before navigating.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="text-sm text-danger mb-3">{error}</div>}
        <span className="text-xs text-slate-400 font-mono block mb-3">Q.{slot}</span>

        {form.imageUrl && (
          <div className="mb-4 relative inline-block">
            <img src={form.imageUrl} alt="" className="max-h-48 rounded-lg border" />
            <button onClick={() => setForm({ ...form, imageUrl: null })} className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs">✕</button>
          </div>
        )}

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

        <button onClick={handleAiSolve} disabled={aiSolving} className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 mb-4">
          {aiSolving ? "Thinking..." : "✨ Solve with AI"}
        </button>
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
          </div>
        )}
      </div>

      <div className="bg-white border-t px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={() => guardedGoTo(Math.max(1, slot - 1))} disabled={slot <= 1} className="btn-secondary text-sm disabled:opacity-40">← Previous</button>
        <span className="text-sm text-slate-500">Question {slot} / {target}</span>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !isDirty} className="btn-primary text-sm disabled:opacity-40">
            {saving ? "Saving..." : isNewSlot ? "Save Question" : "Update Question"}
          </button>
          <button onClick={() => guardedGoTo(Math.min(target, slot + 1))} disabled={slot >= target} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 flex justify-end" onClick={() => setDrawerOpen(false)}>
          <div className="w-96 bg-white h-full p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Question Metadata</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400">✕</button>
            </div>
            <label className="label text-xs">Chapter</label>
            <select className="input mb-4" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value, topic: "" })}>
              {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="label text-xs">Topic</label>
            <input className="input mb-4" list="topic-opts" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <datalist id="topic-opts">{topics.map((t) => <option key={t} value={t} />)}</datalist>
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
