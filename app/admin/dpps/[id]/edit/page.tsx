"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SYLLABUS } from "@/lib/syllabusData";
import Combobox from "@/components/Combobox";
import MultiSelect from "@/components/MultiSelect";
import { DPP_LEVELS } from "@/lib/dppLevels";

const FACULTY_PRESETS = ["By Firoz Sir", "By Yaman Sir", "By Sanu Yadav Sir", "By Mohsin Sir", "By Mukul Sir"];

type DppData = {
  id: string;
  code: string;
  name: string;
  subject: string;
  chapter: string;
  topics: string[];
  facultyName: string | null;
  difficulty: string;
  level: number | null;
  languageMode: string;
  description: string | null;
  tags: string | null;
  instructions: string | null;
  estimatedTimeMin: number;
  correctMarks: number;
  incorrectMarks: number;
  questionTargetCount: number;
  status: string;
};

export default function EditDppPage() {
  const { id: dppId } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<DppData | null>(null);

  useEffect(() => {
    fetch(`/api/dpps/${dppId}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({ ...d, topics: d.topics || [] });
        setLoading(false);
      });
  }, [dppId]);

  const topics = form ? SYLLABUS[form.subject]?.[form.chapter] || [] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/dpps/${dppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        topics: form.topics,
        facultyName: form.facultyName,
        difficulty: form.difficulty,
        level: form.level || null,
        languageMode: form.languageMode,
        description: form.description,
        tags: form.tags,
        instructions: form.instructions,
        estimatedTimeMin: form.estimatedTimeMin,
        correctMarks: form.correctMarks,
        incorrectMarks: form.incorrectMarks,
        questionTargetCount: form.questionTargetCount,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Failed to save");
      return;
    }
    router.push("/admin/dpps");
  }

  if (loading || !form) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/dpps" className="text-sm text-brand mb-2 inline-block">← DPPs</Link>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Edit DPP</h1>
      <p className="text-xs text-slate-400 mb-6">
        <span className="font-mono text-brand">{form.code}</span> · Subject and Chapter are locked once created (questions are already tagged to them).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-danger">{error}</div>}

        <div>
          <label className="label">DPP Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Subject</label>
            <div className="input bg-slate-50 text-slate-500">{form.subject}</div>
          </div>
          <div>
            <label className="label">Chapter</label>
            <div className="input bg-slate-50 text-slate-500">{form.chapter}</div>
          </div>
        </div>

        <div>
          <label className="label">Topics (optional — select all that this DPP covers)</label>
          <MultiSelect values={form.topics} onChange={(v) => setForm({ ...form, topics: v })} options={topics} placeholder="Select topics..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Faculty (display name)</label>
            <Combobox value={form.facultyName || ""} onChange={(v) => setForm({ ...form, facultyName: v })} options={FACULTY_PRESETS} placeholder="By Firoz Sir" />
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
          <label className="label">DPP Level</label>
          <div className="grid grid-cols-1 gap-2">
            {DPP_LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => setForm({ ...form, level: form.level === l.level ? null : l.level })}
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

        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/admin/dpps")} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
