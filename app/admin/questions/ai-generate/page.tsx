"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FormulaEditor from "@/components/FormulaEditor";
import Combobox from "@/components/Combobox";
import { SYLLABUS, resolveBiologySubject } from "@/lib/syllabusData";

type OptionRow = { id: string; text: string };
type Draft = {
  included: boolean;
  statement_en?: string;
  options_en?: OptionRow[];
  statement_hi?: string;
  options_hi?: OptionRow[];
  correctOptionId: string;
  solution_en?: string;
  solution_hi?: string;
};

export default function AiGenerateQuestionsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    subject: "Physics",
    chapter: "",
    topic: "",
    difficulty: "MEDIUM",
    languageMode: "BOTH",
    count: 3,
  });
  const [lockedSubject, setLockedSubject] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.role === "TEACHER" && d.subject) {
          setLockedSubject(d.subject);
          setForm((f) => ({ ...f, subject: d.subject }));
        }
      });
  }, []);

  const chapters = Object.keys(SYLLABUS[form.subject] || {});
  const topics = form.chapter ? SYLLABUS[form.subject]?.[form.chapter] || [] : [];

  async function handleGenerate() {
    if (!form.chapter) {
      setError("Select a chapter first.");
      return;
    }
    setError("");
    setSaveStatus("");
    setGenerating(true);
    const res = await fetch("/api/ai/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.message || "Generation failed");
      return;
    }
    setDrafts((data.questions || []).map((q: any) => ({ ...q, included: true })));
    if (data.warning) setError(`⚠️ ${data.warning}`);
  }

  function updateDraft(idx: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function updateDraftOption(idx: number, lang: "en" | "hi", optIdx: number, text: string) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        const key = lang === "en" ? "options_en" : "options_hi";
        const options = [...(d[key] || [])];
        options[optIdx] = { ...options[optIdx], text };
        return { ...d, [key]: options };
      })
    );
  }

  async function handleSaveSelected() {
    setSaving(true);
    setSaveStatus("");
    let savedCount = 0;
    for (const d of drafts) {
      if (!d.included) continue;
      const translations: any = {};
      if (d.statement_en && d.options_en) {
        translations.en = { statement: d.statement_en, options: d.options_en, correctOptionIds: [d.correctOptionId], solution: d.solution_en || "" };
      }
      if (d.statement_hi && d.options_hi) {
        translations.hi = { statement: d.statement_hi, options: d.options_hi, correctOptionIds: [d.correctOptionId], solution: d.solution_hi || "" };
      }
      if (!translations.en && !translations.hi) continue;

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: resolveBiologySubject(form.subject, form.chapter),
          chapter: form.chapter,
          topic: form.topic,
          type: "SINGLE_CORRECT",
          difficulty: form.difficulty,
          category: "PRACTICE",
          translations,
        }),
      });
      if (res.ok) savedCount++;
    }
    setSaving(false);
    setSaveStatus(`✓ Saved ${savedCount} of ${drafts.filter((d) => d.included).length} selected question(s).`);
    setDrafts((prev) => prev.filter((d) => !d.included));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">✨ AI Question Generator</h1>
      <p className="text-slate-500 text-sm mb-6">
        AI drafts questions for you to review, edit, and save — nothing is added to the Question Bank
        without your approval. Always double-check the answer and solution before saving, especially for
        numerical questions.
      </p>

      <div className="card grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="label">Subject</label>
          <select
            className="input"
            value={form.subject}
            disabled={!!lockedSubject}
            onChange={(e) => setForm({ ...form, subject: e.target.value, chapter: "", topic: "" })}
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
            value={form.chapter}
            onChange={(v) => setForm({ ...form, chapter: v, topic: "" })}
            options={chapters}
            placeholder="Select or type a chapter..."
          />
        </div>
        <div>
          <label className="label">Topic (optional)</label>
          <select className="input" value={form.topic} disabled={!form.chapter} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            <option value="">Any topic in chapter</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Difficulty</label>
          <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <div>
          <label className="label">Language</label>
          <select className="input" value={form.languageMode} onChange={(e) => setForm({ ...form, languageMode: e.target.value })}>
            <option value="ENGLISH">English Only</option>
            <option value="HINDI">Hindi Only</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className="label">How many? (max 5)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={5}
            value={form.count}
            onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
          />
        </div>
      </div>

      {error && <div className="text-sm text-danger mb-4">{error}</div>}

      <button onClick={handleGenerate} disabled={generating} className="btn-primary mb-6">
        {generating ? "Generating..." : "✨ Generate Questions"}
      </button>

      {saveStatus && <div className="text-sm text-success mb-4">{saveStatus}</div>}

      <div className="space-y-4">
        {drafts.map((d, idx) => (
          <div key={idx} className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={d.included}
                  onChange={(e) => updateDraft(idx, { included: e.target.checked })}
                />
                Include this question
              </label>
              <span className="text-xs text-slate-400">Draft {idx + 1}</span>
            </div>

            {(["en", "hi"] as const).map((lang) => {
              const statement = lang === "en" ? d.statement_en : d.statement_hi;
              const options = lang === "en" ? d.options_en : d.options_hi;
              const solution = lang === "en" ? d.solution_en : d.solution_hi;
              if (!statement || !options) return null;
              return (
                <div key={lang} className="mb-4 pb-4 border-b last:border-0">
                  <div className="text-xs font-semibold text-brand mb-1">{lang.toUpperCase()}</div>
                  <FormulaEditor
                    value={statement}
                    onChange={(v) => updateDraft(idx, lang === "en" ? { statement_en: v } : { statement_hi: v })}
                    rows={2}
                  />
                  <div className="space-y-1 mt-2">
                    {options.map((opt, oIdx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center flex-shrink-0 ${
                            d.correctOptionId === opt.id ? "bg-success text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {opt.id}
                        </span>
                        <input
                          className="input font-mono text-sm"
                          value={opt.text}
                          onChange={(e) => updateDraftOption(idx, lang, oIdx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <label className="label text-xs mt-3">Solution ({lang.toUpperCase()})</label>
                  <FormulaEditor
                    value={solution || ""}
                    onChange={(v) => updateDraft(idx, lang === "en" ? { solution_en: v } : { solution_hi: v })}
                    rows={2}
                    placeholder="Explain the correct approach..."
                  />
                </div>
              );
            })}

            <div>
              <label className="label text-xs">Correct Option</label>
              <select
                className="input max-w-[100px] text-sm"
                value={d.correctOptionId}
                onChange={(e) => updateDraft(idx, { correctOptionId: e.target.value })}
              >
                {["A", "B", "C", "D"].map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {drafts.length > 0 && (
        <button onClick={handleSaveSelected} disabled={saving} className="btn-primary mt-4">
          {saving ? "Saving..." : `Save Selected to Question Bank (${drafts.filter((d) => d.included).length})`}
        </button>
      )}
    </div>
  );
}
