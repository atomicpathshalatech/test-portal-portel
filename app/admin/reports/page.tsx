"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type ReportRow = {
  id: string;
  reasonTags: string;
  priority: string;
  status: string;
  createdAt: string;
  question: { questionCode: string | null; subject: string };
  reportedBy: { name: string };
  claimedBy: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  CLAIMED: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-success",
  REJECTED: "bg-red-100 text-danger",
};
const PRIORITY_STYLE: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500",
  MEDIUM: "bg-amber-100 text-warning",
  HIGH: "bg-red-100 text-danger",
};

export default function ReportsDashboardPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    fetch(`/api/reports?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setReports(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [statusFilter, priorityFilter]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Question Reports</h1>
      <p className="text-slate-500 text-sm mb-6">Issues reported by students, ready for teacher review and correction.</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input max-w-[180px] text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="CLAIMED">Claimed</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select className="input max-w-[180px] text-sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-6">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Question</th>
                <th className="py-2 pr-4">Issue</th>
                <th className="py-2 pr-4">Reported By</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-brand">{r.question.questionCode} <span className="text-slate-400">({r.question.subject})</span></td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{r.reasonTags.split(",").join(", ")}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{r.reportedBy.name}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                      {r.status}{r.claimedBy ? ` · ${r.claimedBy.name}` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={`/admin/reports/${r.id}`} className="text-brand text-xs underline hover:opacity-70 transition-opacity duration-150">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No reports match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
