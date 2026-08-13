"use client";
import { useEffect, useState } from "react";
import { SYLLABUS } from "@/lib/syllabusData";

type DoubtRow = {
  id: string;
  subject: string | null;
  chapter: string | null;
  message: string;
  imageUrl: string | null;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  ANSWERED: "bg-green-100 text-success",
  CLOSED: "bg-slate-100 text-slate-400",
};

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];

export default function DoubtsPage() {
  const [doubts, setDoubts] = useState<DoubtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: "", chapter: "", message: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/doubts")
      .then((r) => r.json())
      .then((d) => {
        setDoubts(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const chapters = form.subject ? Object.keys(SYLLABUS[form.subject] || {}) : [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/reports/upload-screenshot", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) setImageUrl(data.url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) {
      setError("Please describe your doubt.");
      return;
    }
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/doubts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, imageUrl }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Failed to submit doubt");
      return;
    }
    setForm({ subject: "", chapter: "", message: "" });
    setImageUrl(null);
    setShowForm(false);
    load();
  }

  return (
    <div className="flex flex-col w-full gap-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-ink">Doubt Portal</h1>
          <p className="text-ink-soft mt-2">Stuck on something? Ask here — a teacher will get back to you.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
          {showForm ? "Cancel" : "+ Ask a Doubt"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-3">
          {error && <div className="text-sm text-danger">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <select
              className="input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value, chapter: "" })}
            >
              <option value="">Subject (optional)</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="input"
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value })}
              disabled={!form.subject}
            >
              <option value="">Chapter (optional)</option>
              {chapters.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <textarea
            className="input"
            rows={4}
            placeholder="Type your doubt here..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <div>
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="" className="h-24 rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-5 h-5 text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="text-xs" />
            )}
            <p className="text-xs text-slate-400 mt-1">Attach a screenshot of the question if that helps explain your doubt.</p>
          </div>
          <button className="btn-primary text-sm" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Doubt"}
          </button>
        </form>
      )}

      <div>
        <h2 className="font-semibold text-ink mb-3">My Doubts</h2>
        {loading ? (
          <div className="card text-center text-ink-soft">Loading...</div>
        ) : doubts.length === 0 ? (
          <div className="card text-center text-ink-soft">No doubts asked yet.</div>
        ) : (
          <div className="space-y-3">
            {doubts.map((d) => (
              <div key={d.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {(d.subject || d.chapter) && (
                      <div className="text-xs text-slate-400 mb-1">
                        {d.subject}
                        {d.chapter ? ` · ${d.chapter}` : ""}
                      </div>
                    )}
                    <p className="text-sm text-ink">{d.message}</p>
                    {d.imageUrl && <img src={d.imageUrl} alt="" className="max-h-32 rounded-lg border mt-2" />}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_STYLE[d.status]}`}>
                    {d.status.replace("_", " ")}
                  </span>
                </div>
                {d.adminResponse && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    <div className="text-xs text-slate-400 mb-1">💬 Response</div>
                    <p className="text-ink-soft">{d.adminResponse}</p>
                  </div>
                )}
                <p className="text-xs text-ink-soft/70 mt-3">{new Date(d.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
