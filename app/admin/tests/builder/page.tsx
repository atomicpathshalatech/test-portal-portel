"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SectionDraft = { name: string; subject: string; targetCount: number; marksPerQuestion?: number; negativeMarks?: number };

function computeEndTime(openTime: string, durationMin: number): string {
  if (!openTime) return "";
  const start = new Date(openTime);
  const end = new Date(start.getTime() + durationMin * 60000);
  return end.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const emptySection = (): SectionDraft => ({ name: "", subject: "Physics", targetCount: 30 });

export default function TestBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesId = searchParams.get("seriesId") || "";

  const [form, setForm] = useState({
    name: "",
    description: "",
    testType: "FULL_SYLLABUS",
    examType: "NEET",
    questionFormat: "OBJECTIVE",
    instructions: "",
    languageMode: "BOTH",
    durationMin: 180,
    openTime: "",
    correctMarks: 4,
    incorrectMarks: -1,
    negativeMarkingEnabled: true,
  });
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()]);
  const [templates, setTemplates] = useState<{ id: string; name: string; sections: SectionDraft[] }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    fetch("/api/test-templates")
      .then((r) => r.json())
      .then((data) =>
        setTemplates(
          data.map((t: any) => ({
            id: t.id,
            name: t.name,
            sections: t.sections.map((s: any) => ({
              name: s.name,
              subject: s.subject,
              targetCount: s.targetCount,
              marksPerQuestion: s.marksPerQuestion ?? undefined,
              negativeMarks: s.negativeMarks ?? undefined,
            })),
          }))
        )
      );
  }, []);

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) setSections(tpl.sections.map((s) => ({ ...s })));
  }

  async function saveAsTemplate() {
    const name = prompt("Name this template (e.g. \"NEET Full Syllabus 180Q\"):");
    if (!name) return;
    if (sections.some((s) => !s.name || !s.subject || s.targetCount < 1)) {
      alert("Fill in all sections properly before saving as a template.");
      return;
    }
    setSavingTemplate(true);
    const res = await fetch("/api/test-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sections }),
    });
    setSavingTemplate(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Failed to save template");
      return;
    }
    const created = await res.json();
    setTemplates((prev) => [{ id: created.id, name, sections }, ...prev]);
    alert(`Template "${name}" saved — you can reuse it next time.`);
  }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateSection(idx: number, patch: Partial<SectionDraft>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection()]);
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!seriesId) {
      setError("Missing test series. Go back and select a series first.");
      return;
    }
    if (sections.some((s) => !s.name || !s.subject || s.targetCount < 1)) {
      setError("Every section needs a name, subject, and a target question count of at least 1.");
      return;
    }

    const closeTime = new Date(new Date(form.openTime).getTime() + form.durationMin * 60000).toISOString();

    setLoading(true);
    const res = await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testSeriesId: seriesId, ...form, closeTime, sections }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to create test");
      return;
    }
    const test = await res.json();
    router.push(`/admin/tests/${test.id}/add-questions`);
  }

  const totalQuestions = sections.reduce((sum, s) => sum + (s.targetCount || 0), 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Create Test</h1>
      <p className="text-slate-500 text-sm mb-6">
        Just the test's information for now — you'll add questions section-by-section on the next
        screen, right after this test is created.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="card grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Test Name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="NEET Grand Test 01"
            />
          </div>
          <div className="col-span-2">
            <label className="label">Description (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Test Type</label>
            <select className="input" value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })}>
              <option value="FULL_SYLLABUS">Full Syllabus Test</option>
              <option value="CHAPTER_TEST">Chapter Test</option>
              <option value="MINOR">Minor Test</option>
              <option value="MAJOR">Major Test</option>
              <option value="MOCK">Mock Test</option>
              <option value="PRACTICE">Practice Test</option>
            </select>
          </div>
          <div>
            <label className="label">Exam Type</label>
            <select className="input" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>
              <option value="NEET">NEET</option>
              <option value="BOARDS">Boards</option>
            </select>
          </div>
          <div>
            <label className="label">Question Format</label>
            <select
              className="input"
              value={form.questionFormat}
              onChange={(e) => setForm({ ...form, questionFormat: e.target.value })}
            >
              <option value="OBJECTIVE">Objective</option>
              <option value="SUBJECTIVE">Subjective</option>
            </select>
          </div>
          <div>
            <label className="label">Language Mode</label>
            <select
              className="input"
              value={form.languageMode}
              onChange={(e) => setForm({ ...form, languageMode: e.target.value })}
            >
              <option value="HINDI">Hindi Only</option>
              <option value="ENGLISH">English Only</option>
              <option value="BOTH">Both (Hindi + English)</option>
            </select>
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input
              className="input"
              type="number"
              required
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Test Date & Start Time</label>
            <input
              className="input"
              type="datetime-local"
              required
              value={form.openTime}
              onChange={(e) => setForm({ ...form, openTime: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End Time (auto-calculated)</label>
            <div className="input bg-slate-50 text-slate-500">
              {form.openTime ? computeEndTime(form.openTime, form.durationMin) : "Set start time first"}
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.negativeMarkingEnabled}
                onChange={(e) => setForm({ ...form, negativeMarkingEnabled: e.target.checked })}
              />
              Negative Marking Enabled
            </label>
          </div>
          {form.negativeMarkingEnabled && (
            <>
              <div>
                <label className="label">Correct Marks</label>
                <input
                  className="input"
                  type="number"
                  value={form.correctMarks}
                  onChange={(e) => setForm({ ...form, correctMarks: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Incorrect Marks</label>
                <input
                  className="input"
                  type="number"
                  value={form.incorrectMarks}
                  onChange={(e) => setForm({ ...form, incorrectMarks: Number(e.target.value) })}
                />
              </div>
            </>
          )}
          <div className="col-span-2">
            <label className="label">Instructions (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-900">Sections</h2>
            <span className="text-xs text-slate-400">{totalQuestions} questions total (defined now, added later)</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Define how many questions each section needs — you'll fill them in on the next screen.
            No question selection happens here.
          </p>

          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <select
              className="input text-sm flex-1"
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Start from a saved template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.sections.reduce((s, sec) => s + sec.targetCount, 0)} Q)
                </option>
              ))}
            </select>
            <button type="button" onClick={saveAsTemplate} disabled={savingTemplate} className="btn-secondary text-sm whitespace-nowrap">
              💾 Save as Template
            </button>
          </div>

          <div className="space-y-3">
            {sections.map((s, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3">
                <div className="col-span-3">
                  <label className="label text-xs">Section Name</label>
                  <input
                    className="input"
                    value={s.name}
                    onChange={(e) => updateSection(idx, { name: e.target.value })}
                    placeholder="Physics"
                  />
                </div>
                <div className="col-span-3">
                  <label className="label text-xs">Subject</label>
                  <select className="input" value={s.subject} onChange={(e) => updateSection(idx, { subject: e.target.value })}>
                    <option>Physics</option>
                    <option>Chemistry</option>
                    <option>Biology</option>
                    <option>Botany</option>
                    <option>Zoology</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Questions</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={s.targetCount}
                    onChange={(e) => updateSection(idx, { targetCount: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Marks/Q (optional)</label>
                  <input
                    className="input"
                    type="number"
                    value={s.marksPerQuestion ?? ""}
                    onChange={(e) => updateSection(idx, { marksPerQuestion: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="uses test default"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  {sections.length > 1 && (
                    <button type="button" onClick={() => removeSection(idx)} className="text-danger text-xs hover:underline transition-all duration-150">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSection} className="btn-secondary text-sm mt-3">
            + Add Section
          </button>
        </div>

        <button className="btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create Test → Open for Question Entry"}
        </button>
      </form>
    </div>
  );
}
