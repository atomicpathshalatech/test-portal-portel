"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type DoubtRow = {
  id: string;
  subject: string | null;
  chapter: string | null;
  message: string;
  status: string;
  createdAt: string;
  student: { name: string; studentIdCode: string | null };
  assignedTo: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  ANSWERED: "bg-green-100 text-success",
  CLOSED: "bg-slate-100 text-slate-400",
};

export default function AdminDoubtsPage() {
  const [doubts, setDoubts] = useState<DoubtRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/doubts${status ? `?status=${status}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setDoubts(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Doubts</h1>
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="ANSWERED">Answered</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="card text-center text-slate-400">Loading...</div>
      ) : doubts.length === 0 ? (
        <div className="card text-center text-slate-400">No doubts match this filter.</div>
      ) : (
        <div className="space-y-3">
          {doubts.map((d) => (
            <Link key={d.id} href={`/admin/doubts/${d.id}`} className="card-interactive block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    {d.student.name} {d.student.studentIdCode ? `(${d.student.studentIdCode})` : ""}
                    {d.subject ? ` · ${d.subject}` : ""}
                    {d.chapter ? ` · ${d.chapter}` : ""}
                  </div>
                  <p className="text-sm text-slate-800 line-clamp-2">{d.message}</p>
                  {d.assignedTo && <p className="text-xs text-slate-400 mt-1">Assigned to {d.assignedTo.name}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_STYLE[d.status]}`}>
                  {d.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">{new Date(d.createdAt).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
