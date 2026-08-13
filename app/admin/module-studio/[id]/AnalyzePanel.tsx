"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Job = {
  id: string;
  stage: string;
  progress: number;
  errorMessage: string | null;
  finishedAt: string | null;
} | null;

type PageRow = {
  pageNumber: number;
  width: number;
  height: number;
  pdfType: string;
  referenceImageUrl: string | null;
  needsReview: boolean;
  elementCount: number;
  warnings: { type: string; message: string }[];
};

export default function AnalyzePanel({
  moduleId,
  status,
  pages,
}: {
  moduleId: string;
  status: string;
  pages: PageRow[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [job, setJob] = useState<Job>(null);
  const [extractJob, setExtractJob] = useState<Job>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});

  const analyzed = pages.some((p) => p.referenceImageUrl);
  const extracted = pages.some((p) => p.elementCount > 0 || p.warnings.length > 0);
  const reviewCount = pages.filter((p) => p.needsReview).length;

  async function startAnalysis() {
    setRunning(true);
    try {
      const res = await fetch(`/api/module-studio/${moduleId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setJob({ id: "", stage: "FAILED", progress: 0, errorMessage: data.message, finishedAt: new Date().toISOString() });
      } else {
        setJob(data.job);
        router.refresh();
      }
    } finally {
      setRunning(false);
    }
  }

  async function startExtraction() {
    setExtracting(true);
    try {
      const res = await fetch(`/api/module-studio/${moduleId}/extract`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setExtractJob({ id: "", stage: "FAILED", progress: 0, errorMessage: data.message, finishedAt: new Date().toISOString() });
      } else {
        setExtractJob(data.job);
        router.refresh();
      }
    } finally {
      setExtracting(false);
    }
  }

  // Poll job status while a run is in flight (POST above blocks until done in
  // this implementation — see the route's execution-model note — but polling
  // is kept here so it keeps working once that route is split into a real
  // background job).
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/module-studio/${moduleId}/analyze`);
      const data = await res.json();
      setJob(data.job);
    }, 2000);
    return () => clearInterval(interval);
  }, [running, moduleId]);

  // Fetch signed thumbnail URLs once pages have reference images.
  useEffect(() => {
    if (!analyzed) return;
    pages.forEach((p) => {
      if (!p.referenceImageUrl || thumbUrls[p.pageNumber]) return;
      fetch(`/api/module-studio/${moduleId}/file?page=${p.pageNumber}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.url) setThumbUrls((prev) => ({ ...prev, [p.pageNumber]: d.url }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzed, pages.length]);

  return (
    <div className="mb-8">
      {!analyzed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800 flex items-center justify-between">
          <div>
            <p className="font-medium mb-1">Not analyzed yet</p>
            <p>Render reference images and detect digital/scanned pages for every page.</p>
          </div>
          <button onClick={startAnalysis} disabled={running} className="btn-primary shrink-0 ml-4">
            {running ? `Analyzing… ${job?.progress ?? 0}%` : "Run Analysis"}
          </button>
        </div>
      )}

      {job?.stage === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-700">
          <p className="font-medium">Analysis failed</p>
          <p>{job.errorMessage}</p>
        </div>
      )}

      {analyzed && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Pages ({pages.length})</h2>
            {!extracted && (
              <button onClick={startExtraction} disabled={extracting} className="btn-primary text-sm">
                {extracting ? `Extracting… ${extractJob?.progress ?? 0}%` : "Extract Content"}
              </button>
            )}
          </div>

          {extractJob?.stage === "FAILED" && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-sm text-red-700">
              <p className="font-medium">Extraction failed</p>
              <p>{extractJob.errorMessage}</p>
            </div>
          )}

          {extracted && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 text-sm">
              <p className="text-slate-700">
                <strong>{pages.reduce((sum, p) => sum + p.elementCount, 0)}</strong> elements extracted across{" "}
                {pages.length} pages.{" "}
                {reviewCount > 0 ? (
                  <span className="text-amber-700">
                    {reviewCount} page{reviewCount === 1 ? "" : "s"} flagged for review.
                  </span>
                ) : (
                  <span className="text-emerald-700">No pages flagged.</span>
                )}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Extraction is heuristic (text grouping, heading/question detection) — every page
                is marked for review until confirmed. There is no visual editor yet to make
                corrections in; this view is read-only.
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {pages.map((p) => (
              <Link
                key={p.pageNumber}
                href={`/admin/module-studio/${moduleId}/${p.pageNumber}`}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-200 block"
              >
                <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center relative">
                  {thumbUrls[p.pageNumber] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrls[p.pageNumber]}
                      alt={`Page ${p.pageNumber}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Loading…</span>
                  )}
                  {p.needsReview && extracted && (
                    <span className="absolute top-1 right-1 bg-amber-400 text-amber-900 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      REVIEW
                    </span>
                  )}
                </div>
                <div className="px-2 py-1.5 text-xs text-slate-500 flex items-center justify-between">
                  <span>#{p.pageNumber}</span>
                  <span>{p.pdfType}</span>
                </div>
                {extracted && (
                  <div className="px-2 pb-1.5 text-[10px] text-slate-400">
                    {p.elementCount} element{p.elementCount === 1 ? "" : "s"}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
