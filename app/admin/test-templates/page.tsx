"use client";
import { useEffect, useState } from "react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  createdBy: { name: string } | null;
  createdAt: string;
  sections: { id: string; name: string; subject: string; targetCount: number }[];
};

export default function TestTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/test-templates")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? Tests already created from it are unaffected.`)) return;
    await fetch(`/api/test-templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Test Templates</h1>
      <p className="text-slate-500 text-sm mb-6">
        Reusable section-structure blueprints. Save one from the Create Test screen ("Save as Template"),
        then load it next time instead of re-typing sections from scratch.
      </p>

      {loading ? (
        <div className="text-center text-slate-400 py-6">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="card text-center text-slate-400">
          No templates saved yet — build a test's sections once, then click "Save as Template".
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t.sections.map((s) => `${s.subject} (${s.targetCount})`).join(" · ")}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {t.sections.reduce((s, sec) => s + sec.targetCount, 0)} questions total · by {t.createdBy?.name || "—"} ·{" "}
                  {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => handleDelete(t.id, t.name)} className="text-xs text-danger underline hover:opacity-70 transition-opacity duration-150">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
