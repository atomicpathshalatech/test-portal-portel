"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PageInfo = {
  pageNumber: number;
  needsReview: boolean;
  warnings: { type: string; message: string }[];
  elementCount: number;
};

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [mod, setMod] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/module-studio/${params.id}`)
      .then((r) => r.json())
      .then((d) => setMod(d.module));
  }, [params.id]);

  const pages: PageInfo[] = (mod?.pages || []).map((p: any) => ({
    pageNumber: p.pageNumber,
    needsReview: p.needsReview,
    warnings: p.warnings || [],
    elementCount: Array.isArray(p.elements) ? p.elements.length : 0,
  }));
  const pendingPages = pages.filter((p) => p.needsReview);
  const hasBranding = (mod?.pages || []).some((p: any) =>
    (p.elements || []).some((el: any) => ["HEADER", "FOOTER", "WATERMARK"].includes(el.type))
  );

  async function markReviewed(force: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/module-studio/${params.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    router.refresh();
    setMod(data.module);
  }

  if (!mod) return <p className="text-slate-400 text-sm">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/module-studio/${params.id}`} className="text-sm text-indigo-600">
        ← {mod.title}
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mt-1 mb-6">Review</h1>

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 mb-6">
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm text-slate-700">Pages ready</span>
          <span className={pendingPages.length === 0 ? "text-emerald-600 font-medium" : "text-amber-700 font-medium"}>
            {pages.length - pendingPages.length} / {pages.length}
          </span>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm text-slate-700">Branding applied</span>
          <span className={hasBranding ? "text-emerald-600 font-medium" : "text-slate-400"}>
            {hasBranding ? "Yes" : "Not applied"}
          </span>
        </div>
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm text-slate-700">Module status</span>
          <span className="font-medium text-slate-900">{mod.status.replace("_", " ")}</span>
        </div>
        {mod.reviewedAt && (
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-slate-700">Last reviewed</span>
            <span className="text-slate-500 text-sm">{new Date(mod.reviewedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {pendingPages.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-2">
            {pendingPages.length} page{pendingPages.length === 1 ? "" : "s"} flagged for review
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            {pendingPages.slice(0, 10).map((p) => (
              <li key={p.pageNumber}>
                <Link href={`/admin/module-studio/${params.id}/${p.pageNumber}`} className="underline">
                  Page {p.pageNumber}
                </Link>
                {p.warnings.length > 0 && ` — ${p.warnings.map((w) => w.message).join("; ")}`}
              </li>
            ))}
          </ul>
          {pendingPages.length > 10 && (
            <p className="text-xs text-amber-600 mt-2">+{pendingPages.length - 10} more</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy || pendingPages.length > 0} onClick={() => markReviewed(false)}>
          Mark as Reviewed
        </button>
        {pendingPages.length > 0 && (
          <button className="btn-secondary" disabled={busy} onClick={() => markReviewed(true)}>
            Mark Reviewed Anyway
          </button>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 mt-8">
        <p className="font-medium text-slate-700 mb-1">Export not yet built</p>
        <p>
          This review step is the gate before export, but the export engine itself (spec §32,
          Phase 10) hasn't been implemented — marking a module reviewed sets its status to READY,
          it doesn't produce a PDF yet.
        </p>
      </div>
    </div>
  );
}
