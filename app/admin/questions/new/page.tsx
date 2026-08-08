"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FormulaEditor from "@/components/FormulaEditor";
import FormulaText from "@/components/FormulaText";
import { SYLLABUS } from "@/lib/syllabusData";

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
  const [aiResult, setAiResult] = useState<{ correctOptionId: string | null; confidence: string } | null>(null);
  const [aiError, setAiError] = useState("");
  const [pyqOptions, setPyqOptions] = useState<string[]>([]);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [lockedSubject, setLockedSubject] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"hi" | "en">("en");
  const [enableHi, setEnableHi] = useState(true);
  const [enableEn, setEnableEn] = useState(true);
  const isIntegerType = meta.type === "INTEGER" || meta.type === "NUMERICAL";
  const [hi, setHi] = useState<LangContent>(emptyLang());
  const [en, setEn] = useState<LangContent>(emptyLang());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
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
        setActiveLang(enT ? "en" : "hi");
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

  const current = activeLang === "hi" ? hi : en;
  const setCurrent = activeLang === "hi" ? setHi : setEn;

  function updateOption(idx: number, text: string) {
    const options = [...current.options];
    options[idx] = { ...options[idx], text };
    setCurrent({ ...current, options });
  }

  function toggleCorrect(optionId: string) {
    const isMulti = meta.type === "MULTIPLE_CORRECT";
    let ids = current.correctOptionIds;
    if (isMulti) {
      ids = ids.includes(optionId) ? ids.filter((i) => i !== optionId) : [...ids, optionId];
    } else {
      ids = [optionId];
    }
    setCurrent({ ...current, correctOptionIds: ids });
  }

  async function handleSubmit(e: React.FormEvent) {
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

    if (editId) {
      const res = await fetch(`/api/questions/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meta, translations, imageUrl, reason: editReason }),
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
      body: JSON.stringify({ ...meta, translations, imageUrl }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to create question");
      return;
    }
    const created = await res.json();

    if (sectionId) {
      await fetch(`/api/sections/${sectionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: created.id }),
      });
      const testId = searchParams.get("testId");
      router.push(
        testId
          ? `/admin/tests/${testId}/add-questions/${sectionId}?added=${created.id}`
          : "/admin/questions"
      );
      return;
    }

    setCreatedCode(created.questionCode);
  }

  function backLink() {
    if (meta.chapter) return `/admin/questions/${encodeURIComponent(meta.subject)}/${encodeURIComponent(meta.chapter)}`;
    return `/admin/questions/${encodeURIComponent(meta.subject)}`;
  }

  async function handleAiSolve() {
    if (!current.statement.trim()) {
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
        subject: meta.subject,
        chapter: meta.chapter,
        topic: meta.topic,
        statement: current.statement,
        options: current.options,
        language: activeLang,
        questionType: meta.type,
      }),
    });
    const data = await res.json();
    setAiSolving(false);
    if (!res.ok) {
      setAiError(data.message || "AI solve failed");
      return;
    }
    setCurrent({ ...current, solution: data.solution || "" });
    setAiResult({ correctOptionId: data.correctOptionId, confidence: data.confidence });
  }

  function applyAiAnswer() {
    if (!aiResult?.correctOptionId) return;
    setCurrent({ ...current, correctOptionIds: [aiResult.correctOptionId] });
  }

  return (
    <div className="max-w-3xl">
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
      <form onSubmit={handleSubmit} className="space-y-6">
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
              <option>Botany</option>
              <option>Zoology</option>
            </select>
          </div>
          <div>
            <label className="label">Chapter</label>
            <select
              className="input"
              value={meta.chapter}
              onChange={(e) => setMeta({ ...meta, chapter: e.target.value, topic: "" })}
            >
              <option value="">Select chapter...</option>
              {chapters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        <div className="card">
          <label className="label">Question Image / Diagram (optional, shared across languages)</label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Question diagram" className="max-h-48 rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs font-bold"
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

        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableHi} onChange={(e) => setEnableHi(e.target.checked)} />
              हिंदी (Hindi)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableEn} onChange={(e) => setEnableEn(e.target.checked)} />
              English
            </label>
          </div>

          <div className="flex gap-2 mb-4 border-b">
            {enableHi && (
              <button
                type="button"
                onClick={() => setActiveLang("hi")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeLang === "hi" ? "border-brand text-brand" : "border-transparent text-slate-500"
                }`}
              >
                हिंदी
              </button>
            )}
            {enableEn && (
              <button
                type="button"
                onClick={() => setActiveLang("en")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeLang === "en" ? "border-brand text-brand" : "border-transparent text-slate-500"
                }`}
              >
                English
              </button>
            )}
          </div>

          <div>
            <label className="label">Statement ({activeLang.toUpperCase()})</label>
            <FormulaEditor
              value={current.statement}
              onChange={(v) => setCurrent({ ...current, statement: v })}
              rows={3}
              placeholder={
                activeLang === "hi"
                  ? "प्रश्न यहाँ लिखें..."
                  : "Enter question statement..."
              }
            />

            {isIntegerType ? (
              <>
                <label className="label mt-4">Correct {meta.type === "INTEGER" ? "Integer" : "Numerical"} Value</label>
                <input
                  className="input font-mono text-sm max-w-xs"
                  value={current.correctOptionIds[0] || ""}
                  onChange={(e) => setCurrent({ ...current, correctOptionIds: [e.target.value] })}
                  placeholder={meta.type === "INTEGER" ? "e.g. 42" : "e.g. 9.8"}
                />
              </>
            ) : (
              <>
                <label className="label mt-4">Options — click ✓ to mark correct</label>
                <div className="space-y-2">
                  {current.options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(opt.id)}
                        className={`w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 mt-0 ${
                          current.correctOptionIds.includes(opt.id)
                            ? "bg-success text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {opt.id}
                      </button>
                      <div className="flex-1">
                        <FormulaEditor
                          value={opt.text}
                          onChange={(v) => updateOption(idx, v)}
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
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">
              Solution / Explanation ({activeLang === "hi" ? "हिंदी" : "English"}) <span className="text-danger">*</span> (shown to students post-test, matching this language)
            </label>
            <button
              type="button"
              onClick={handleAiSolve}
              disabled={aiSolving}
              className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 whitespace-nowrap"
            >
              {aiSolving ? "Thinking..." : "✨ Solve with AI"}
            </button>
          </div>
          {aiError && <p className="text-xs text-danger mb-2">{aiError}</p>}
          {aiResult && (
            <div
              className={`text-xs rounded-lg px-3 py-2 mb-2 ${
                aiResult.confidence === "low" ? "bg-amber-50 text-warning" : "bg-purple-50 text-purple-700"
              }`}
            >
              AI confidence: <strong>{aiResult.confidence}</strong>
              {!isIntegerType && aiResult.correctOptionId && (
                <>
                  {" "}
                  · AI thinks the answer is <strong>{aiResult.correctOptionId}</strong>
                  {current.correctOptionIds[0] !== aiResult.correctOptionId && (
                    <>
                      {" "}
                      (you marked <strong>{current.correctOptionIds[0] || "none"}</strong> —{" "}
                      <button type="button" onClick={applyAiAnswer} className="underline font-medium">
                        use AI's answer
                      </button>
                      )
                    </>
                  )}
                </>
              )}
              {isIntegerType && aiResult.correctOptionId && (
                <>
                  {" "}
                  · AI computed <strong>{aiResult.correctOptionId}</strong>
                  {current.correctOptionIds[0] !== aiResult.correctOptionId && (
                    <>
                      {" "}
                      (you entered <strong>{current.correctOptionIds[0] || "none"}</strong> —{" "}
                      <button type="button" onClick={applyAiAnswer} className="underline font-medium">
                        use AI's value
                      </button>
                      )
                    </>
                  )}
                </>
              )}
              <div className="mt-1 text-slate-500">
                ⚠️ AI can make mistakes, especially on calculations — always verify before publishing.
              </div>
            </div>
          )}
          <FormulaEditor
            value={current.solution}
            onChange={(v) => setCurrent({ ...current, solution: v })}
            rows={3}
            placeholder="Explain the correct approach... or click 'Solve with AI' above"
          />
        </div>

        <button className="btn-primary" disabled={loading || uploadingImage}>
          {loading ? "Saving..." : editId ? "Update Question" : "Save Question"}
        </button>
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
