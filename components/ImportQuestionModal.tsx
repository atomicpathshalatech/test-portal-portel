"use client";
import { useState } from "react";
import FormulaText from "@/components/FormulaText";

type ExistingLink = { questionId: string; sectionName: string; position: number };
type FoundQuestion = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  difficulty: string;
  archived: boolean;
  imageUrl: string | null;
  translations: { language: string; statement: string; options: { id: string; text: string }[]; correctOptionIds: string[] }[];
};

export default function ImportQuestionModal({
  existingLinks,
  onImport,
  onClose,
}: {
  existingLinks: ExistingLink[];
  onImport: (questionId: string) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
}) {
  const [idInput, setIdInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const [found, setFound] = useState<FoundQuestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicate, setDuplicate] = useState<ExistingLink | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleLookup() {
    const code = idInput.trim().toUpperCase();
    if (!code) return;
    setStatus("loading");
    setDuplicate(null);
    setErrorMsg("");
    const res = await fetch(`/api/questions?code=${encodeURIComponent(code)}`);
    const list = await res.json();
    const q: FoundQuestion | undefined = Array.isArray(list) ? list[0] : undefined;

    if (!q) {
      setStatus("notfound");
      setFound(null);
      return;
    }
    if (q.archived) {
      setStatus("error");
      setErrorMsg("Question is archived and cannot be imported.");
      setFound(null);
      return;
    }
    const dup = existingLinks.find((l) => l.questionId === q.id);
    if (dup) {
      setDuplicate(dup);
      setFound(q);
      setStatus("found");
      return;
    }
    setFound(q);
    setStatus("found");
  }

  async function handleConfirm() {
    if (!found || duplicate) return;
    setImporting(true);
    const result = await onImport(found.id);
    setImporting(false);
    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.message || "Import failed.");
      return;
    }
    onClose();
  }

  const t = found?.translations[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-center text-slate-900 mb-4">Import Question</h2>

        <label className="label">Question ID</label>
        <div className="flex gap-2">
          <input
            className="input font-mono"
            placeholder="e.g. CH35659"
            value={idInput}
            autoFocus
            onChange={(e) => {
              setIdInput(e.target.value);
              setStatus("idle");
              setFound(null);
              setDuplicate(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <button onClick={handleLookup} disabled={status === "loading" || !idInput.trim()} className="btn-secondary text-sm whitespace-nowrap">
            {status === "loading" ? "..." : "Look Up"}
          </button>
        </div>

        {status === "notfound" && <p className="text-sm text-danger mt-3">Question ID not found.</p>}
        {status === "error" && <p className="text-sm text-danger mt-3">{errorMsg}</p>}

        {duplicate && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-warning/30">
            <div className="font-medium text-warning mb-1">⚠️ Question Already Added</div>
            <p className="text-sm text-ink-soft">This question is already added to this Test/DPP.</p>
            <p className="text-xs text-slate-500 mt-1">
              {duplicate.sectionName} · Question {duplicate.position}
            </p>
          </div>
        )}

        {found && !duplicate && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="font-mono text-brand font-semibold">{found.questionCode}</span>
              <span>·</span>
              <span>
                {found.subject}
                {found.chapter ? ` · ${found.chapter}` : ""}
              </span>
              <span>·</span>
              <span>{found.difficulty}</span>
            </div>
            {found.imageUrl && <img src={found.imageUrl} alt="" className="max-h-32 rounded-lg border mb-2" />}
            <p className="text-sm text-slate-800 mb-2">
              <FormulaText text={t?.statement || ""} />
            </p>
            {t && t.options.length > 0 && (
              <div className="space-y-1">
                {t.options.map((opt) => (
                  <div
                    key={opt.id}
                    className={`text-xs px-2 py-1 rounded ${
                      t.correctOptionIds.includes(opt.id) ? "bg-green-100 text-success font-medium" : "text-slate-600"
                    }`}
                  >
                    {opt.id}. <FormulaText text={opt.text} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!found || !!duplicate || importing}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {importing ? "Importing..." : "Confirm Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
