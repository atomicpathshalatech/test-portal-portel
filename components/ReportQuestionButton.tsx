"use client";
import { useState } from "react";

const REASON_OPTIONS = [
  { value: "WRONG_ANSWER", label: "Wrong Answer" },
  { value: "INCORRECT_QUESTION", label: "Incorrect Question" },
  { value: "IMAGE_MISSING", label: "Image Missing" },
  { value: "TYPO", label: "Typo" },
  { value: "WRONG_OPTION", label: "Wrong Option" },
  { value: "WRONG_SOLUTION", label: "Wrong Solution" },
  { value: "LANGUAGE_ISSUE", label: "Language Issue" },
  { value: "OUT_OF_SYLLABUS", label: "Question Out of Syllabus" },
  { value: "DUPLICATE_QUESTION", label: "Duplicate Question" },
  { value: "OTHER", label: "Other" },
];

export default function ReportQuestionButton({ questionId, testId }: { questionId: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggle(value: string) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/reports/upload-screenshot", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) setScreenshotUrl(data.url);
  }

  async function handleSubmit() {
    if (selected.length === 0) {
      setError("Select at least one issue.");
      return;
    }
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, testId, reasonTags: selected, comment, screenshotUrl }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Failed to submit report");
      return;
    }
    setSubmitted(true);
  }

  function closeAndReset() {
    setOpen(false);
    setTimeout(() => {
      setSelected([]);
      setComment("");
      setScreenshotUrl(null);
      setSubmitted(false);
      setError("");
    }, 300);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-danger flex items-center gap-1 hover:underline"
      >
        <span className="material-symbols-outlined text-sm">flag</span>
        Report Question
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={closeAndReset}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✅</div>
                <h3 className="font-semibold text-slate-900 mb-1">Report Submitted</h3>
                <p className="text-sm text-slate-500 mb-4">Thanks — a teacher will review this shortly.</p>
                <button onClick={closeAndReset} className="btn-primary text-sm">
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-900 mb-4">⚠ Report Question</h3>
                {error && <div className="text-sm text-danger mb-3">{error}</div>}
                <div className="space-y-2 mb-4">
                  {REASON_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <textarea
                  className="input mb-3 text-sm"
                  rows={3}
                  placeholder="Describe your issue..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="mb-4">
                  {screenshotUrl ? (
                    <div className="relative inline-block">
                      <img src={screenshotUrl} alt="" className="h-20 rounded-lg border" />
                      <button onClick={() => setScreenshotUrl(null)} className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-5 h-5 text-xs">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="text-xs" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={closeAndReset} className="btn-secondary text-sm flex-1">
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm flex-1">
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
