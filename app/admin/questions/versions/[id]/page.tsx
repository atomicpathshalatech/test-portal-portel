"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";

type QuestionMeta = {
  id: string;
  questionCode: string | null;
  createdByName: string | null;
  createdAt: string;
  isPublished: boolean;
  publishedByName: string | null;
  publishedAt: string | null;
};
type VersionRow = {
  id: string;
  versionNumber: number;
  editedAt: string;
  reason: string | null;
  changeType: string;
  editedBy: { name: string };
  snapshot: any;
};

export default function VersionHistoryPage() {
  const { id: questionId } = useParams<{ id: string }>();
  const [question, setQuestion] = useState<QuestionMeta | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  function load() {
    fetch(`/api/questions/${questionId}/versions`)
      .then((r) => r.json())
      .then((d) => {
        setQuestion(d.question);
        setVersions(d.versions);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [questionId]);

  async function handleRestore(versionId: string, versionNumber: number) {
    if (!confirm(`Restore this question to Version ${versionNumber}? This will create a new version, not delete history.`)) return;
    setRestoring(versionId);
    const reason = prompt("Reason for restoring (optional):") || "";
    const res = await fetch(`/api/questions/${questionId}/versions/${versionId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setRestoring(null);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Restore failed");
      return;
    }
    load();
  }

  if (loading || !question) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/questions" className="text-sm text-brand mb-2 inline-block">
        ← Question Bank
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">
        Version History — <span className="font-mono text-brand">{question.questionCode}</span>
      </h1>

      <div className="card mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-400">Created By</div>
          <div className="font-medium text-slate-800">{question.createdByName || "—"}</div>
          <div className="text-xs text-slate-400">{new Date(question.createdAt).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Published By</div>
          {question.isPublished ? (
            <>
              <div className="font-medium text-slate-800">{question.publishedByName || "—"}</div>
              <div className="text-xs text-slate-400">{question.publishedAt ? new Date(question.publishedAt).toLocaleString() : "—"}</div>
            </>
          ) : (
            <div className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 inline-block mt-1">
              Not published yet — edits aren't tracked
            </div>
          )}
        </div>
      </div>

      {!question.isPublished && (
        <div className="card text-center text-slate-400 text-sm">
          This question is still in draft — unlimited edits are allowed and none are recorded. Version
          history begins the moment it's part of a published test.
        </div>
      )}

      {question.isPublished && (
        <div className="space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-slate-900">Version {v.versionNumber}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${v.changeType === "RESTORE" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                    {v.changeType}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(v.id, v.versionNumber)}
                  disabled={restoring === v.id || v.versionNumber === versions[0].versionNumber}
                  className="text-xs text-brand underline hover:opacity-70 transition-opacity duration-150 disabled:opacity-30 disabled:no-underline"
                >
                  {v.versionNumber === versions[0].versionNumber ? "Current" : "Restore"}
                </button>
              </div>
              <div className="text-xs text-slate-500 mb-2">
                Edited by <strong>{v.editedBy.name}</strong> · {new Date(v.editedAt).toLocaleString()}
              </div>
              {v.reason && <div className="text-sm text-slate-600 mb-2">Reason: {v.reason}</div>}
              <div className="text-xs text-slate-400 border-t pt-2 mt-2">
                <FormulaText text={v.snapshot?.translations?.[0]?.statement?.slice(0, 100) || ""} />
              </div>
            </div>
          ))}
          {versions.length === 0 && (
            <div className="card text-center text-slate-400">No edits since this question was published.</div>
          )}
        </div>
      )}
    </div>
  );
}
