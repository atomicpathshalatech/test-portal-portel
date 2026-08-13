"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type ModuleRow = {
  id: string;
  code: string;
  title: string;
  subject: string | null;
  class: string | null;
  status: string;
  pdfType: string;
  pageCount: number | null;
  originalFileName: string;
  createdAt: string;
  createdBy: { name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber-100 text-amber-700",
  REVIEW_REQUIRED: "bg-orange-100 text-orange-700",
  READY: "bg-emerald-100 text-emerald-700",
  PUBLISHED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
  FAILED: "bg-red-100 text-red-700",
};

export default function ModuleStudioListPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/module-studio")
      .then((r) => r.json())
      .then((d) => {
        setModules(d.modules || []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Module Studio</h1>
          <p className="text-slate-500 text-sm mt-1">
            Import educational module PDFs, apply Atomic Pathshala branding, and export.
          </p>
        </div>
        <Link href="/admin/module-studio/upload" className="btn-primary">
          + Upload Module
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : modules.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
          No modules uploaded yet.{" "}
          <Link href="/admin/module-studio/upload" className="text-indigo-600 font-medium">
            Upload your first PDF
          </Link>
          .
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Subject / Class</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">PDF Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Uploaded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modules.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/admin/module-studio/${m.id}`} className="hover:text-indigo-600">
                      {m.title}
                    </Link>
                    <div className="text-xs text-slate-400">{m.originalFileName}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[m.subject, m.class].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.pageCount ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{m.pdfType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_STYLES[m.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.createdBy?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
