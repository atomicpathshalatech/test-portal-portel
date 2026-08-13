"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SYLLABUS } from "@/lib/syllabusData";
import Combobox from "@/components/Combobox";
import MultiSelect from "@/components/MultiSelect";
import { DPP_LEVELS } from "@/lib/dppLevels";

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];
const FACULTY_PRESETS = ["By Firoz Sir", "By Yaman Sir", "By Sanu Yadav Sir", "By Mohsin Sir", "By Mukul Sir"];

export default function NewDppPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    subject: "Physics",
    chapter: "",
    topics: [] as string[],
    facultyName: "",
    difficulty: "MEDIUM",
    level: 0,
    languageMode: "BOTH",
    description: "",
    tags: "",
    instructions: "",
    estimatedTimeMin: 30,
    correctMarks: 4,
    incorrectMarks: -1,
    negativeMarkingEnabled: true,
    questionTargetCount: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const chapters = Object.keys(SYLLABUS[form.subject] || {});
  const topics = form.chapter ? SYLLABUS[form.subject]?.[form.chapter] || [] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.chapter) {
      setError("Chapter is required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/dpps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, level: form.level || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Failed to create DPP");
      return;
    }
    const created = await res.json();
    router.push(`/admin/dpps/${created.id}/add-questions`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Create DPP</h1>
      <p className="text-xs text-slate-400 mb-4">A unique code (e.g. AP0001) will be generated automatically.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-danger">{error}</div>}

        <div>
          <label className="label">DPP Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mole Concept — Basic Concepts" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Subject</label>
            <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, chapter: "" })}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Chapter</label>
            <Combobox
              value={form.chapter}
              onChange={(v) => setForm({ ...form, chapter: v, topics: [] })}
              options={chapters}
              placeholder="Select or type a chapter..."
            />
          </div>
        </div>

        <div>
          <label className="label">Topics (optional — select all that this DPP covers)</label>
          <MultiSelect
            values={form.topics}
            onChange={(v) => setForm({ ...form, topics: v })}
            options={topics}
            placeholder={form.chapter ? "Select topics..." : "Select chapter first"}
            disabled={!form.chapter}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Faculty (display name)</label>
            <Combobox value={form.facultyName} onChange={(v) => setForm({ ...form, facultyName: v })} options={FACULTY_PRESETS} placeholder="By Firoz Sir" />
          </div>
          <div>
            <label className="label">Language</label>
            <select className="input" value={form.languageMode} onChange={(e) => setForm({ ...form, languageMode: e.target.value })}>
              <option value="BOTH">Both</option>
              <option value="ENGLISH">English</option>
              <option value="HINDI">Hindi</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">DPP Level (optional — defines the question style for this DPP)</label>
          <div className="grid grid-cols-1 gap-2">
            {DPP_LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => setForm({ ...form, level: form.level === l.level ? 0 : l.level })}
                className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 active:scale-[0.99] ${
                  form.level === l.level ? "border-brand bg-brand-light" : "border-slate-200 hover:border-brand/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.level === l.level ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
                    LEVEL {l.level}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{l.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{l.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <div>
            <label className="label">Questions</label>
            <input type="number" min={1} className="input" value={form.questionTargetCount} onChange={(e) => setForm({ ...form, questionTargetCount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Est. Time (min)</label>
            <input type="number" min={5} className="input" value={form.estimatedTimeMin} onChange={(e) => setForm({ ...form, estimatedTimeMin: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Correct Marks</label>
            <input type="number" className="input" value={form.correctMarks} onChange={(e) => setForm({ ...form, correctMarks: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Incorrect Marks</label>
            <input type="number" className="input" value={form.incorrectMarks} onChange={(e) => setForm({ ...form, incorrectMarks: Number(e.target.value) })} />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Creating..." : "Create DPP & Add Questions →"}
        </button>
      </form>
    </div>
  );
}
