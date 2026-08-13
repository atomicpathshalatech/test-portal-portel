"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type DoubtDetail = {
  id: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  message: string;
  imageUrl: string | null;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
  student: { name: string; studentIdCode: string | null; email: string };
  assignedTo: { name: string } | null;
};

export default function AdminDoubtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doubt, setDoubt] = useState<DoubtDetail | null>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch(`/api/doubts/${id}`)
      .then((r) => r.json())
      .then(setDoubt);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function doAction(body: any) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/doubts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Action failed");
      return;
    }
    load();
  }

  if (!doubt) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/doubts" className="text-sm text-brand mb-4 inline-block hover:opacity-70 transition-opacity duration-150">
        ← All Doubts
      </Link>

      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold text-slate-900">{doubt.student.name}</div>
            <div className="text-xs text-slate-400">
              {doubt.student.studentIdCode} · {doubt.student.email}
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
            {doubt.status.replace("_", " ")}
          </span>
        </div>
        {(doubt.subject || doubt.chapter) && (
          <div className="text-xs text-slate-400 mb-2">
            {doubt.subject}
            {doubt.chapter ? ` · ${doubt.chapter}` : ""}
            {doubt.topic ? ` · ${doubt.topic}` : ""}
          </div>
        )}
        <p className="text-slate-800">{doubt.message}</p>
        {doubt.imageUrl && <img src={doubt.imageUrl} alt="" className="max-h-64 rounded-lg border mt-3" />}
        <p className="text-xs text-slate-400 mt-3">{new Date(doubt.createdAt).toLocaleString()}</p>
      </div>

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      {doubt.status === "OPEN" && (
        <button onClick={() => doAction({ action: "claim" })} disabled={saving} className="btn-secondary text-sm mb-4">
          Claim this doubt
        </button>
      )}

      {doubt.assignedTo && doubt.status !== "ANSWERED" && doubt.status !== "CLOSED" && (
        <div className="card">
          <label className="label">Your response</label>
          <textarea className="input" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain the answer..." />
          <button
            onClick={() => doAction({ action: "respond", adminResponse: response })}
            disabled={saving || !response.trim()}
            className="btn-primary text-sm mt-3"
          >
            {saving ? "Sending..." : "Send Response"}
          </button>
        </div>
      )}

      {doubt.adminResponse && (
        <div className="card mt-4">
          <div className="text-xs text-slate-400 mb-1">💬 Response sent</div>
          <p className="text-slate-800">{doubt.adminResponse}</p>
          {doubt.resolvedAt && <p className="text-xs text-slate-400 mt-2">{new Date(doubt.resolvedAt).toLocaleString()}</p>}
        </div>
      )}
    </div>
  );
}
