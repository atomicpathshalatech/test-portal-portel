"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export type TestItem = {
  id: string;
  name: string;
  questionCount: number;
  totalMarks: number;
  durationMin: number;
  openTime: string;
  closeTime: string;
  status: "LIVE" | "UPCOMING" | "COMPLETED" | "MISSED" | "AVAILABLE";
  isInProgress: boolean;
  score: number | null;
  attemptId: string | null;
};
export type ChapterGroup = { number: number; chapter: string; tests: TestItem[] };

const SUBJECT_TABS = ["Physics", "Chemistry", "Biology"];

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-8 bg-slate-200 rounded mb-3" />
      <div className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-1/3 bg-slate-100 rounded" />
    </div>
  );
}

function StatusTag({ status }: { status: TestItem["status"] }) {
  const map: Record<TestItem["status"], { label: string; className: string }> = {
    LIVE: { label: "● Live", className: "text-success" },
    AVAILABLE: { label: "● Available", className: "text-success" },
    UPCOMING: { label: "Upcoming", className: "text-slate-400" },
    COMPLETED: { label: "✓ Completed", className: "text-brand" },
    MISSED: { label: "Missed", className: "text-danger" },
  };
  const s = map[status];
  return <span className={`text-xs font-medium ${s.className}`}>{s.label}</span>;
}

export default function ChapterTestList({ mode }: { mode: "online" | "pdf" }) {
  const [subject, setSubject] = useState("Physics");
  const [chapters, setChapters] = useState<ChapterGroup[] | null>(null);
  const [error, setError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  function load(s: string) {
    setChapters(null);
    setError(false);
    fetch(`/api/my-tests?subject=${encodeURIComponent(s)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setChapters(d.chapters))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function handleDownload(testId: string) {
    setDownloadingId(testId);
    // Give the "Preparing..." state a moment to register before the browser
    // takes over with its own download UI — the PDF itself streams from the
    // existing, already-built export endpoint (no new PDF logic needed).
    const a = document.createElement("a");
    a.href = `/api/tests/${testId}/export-pdf`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloadingId(null), 900);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-1">{mode === "online" ? "Attempt Online" : "Download PDF"}</h1>
      <p className="text-ink-soft text-sm mb-6">
        {mode === "online" ? "Chapter-wise tests, take them right here." : "Practice offline with complete test + solutions."}
      </p>

      {/* Subject tabs — client-side state only, no route change/reload */}
      <div className="relative flex gap-1 mb-6 bg-surface-container rounded-full p-1 w-fit">
        {SUBJECT_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={`relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
              subject === s ? "bg-white shadow-sm text-brand" : "text-ink-soft hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="card text-center py-10">
          <p className="text-ink font-medium mb-1">Something went wrong.</p>
          <p className="text-ink-soft text-sm mb-4">We couldn't load your tests.</p>
          <button onClick={() => load(subject)} className="btn-secondary text-sm">
            Try Again
          </button>
        </div>
      )}

      {!error && chapters === null && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!error && chapters && chapters.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-ink font-medium mb-1">No chapter tests yet</p>
          <p className="text-ink-soft text-sm">Your upcoming tests will appear here.</p>
        </div>
      )}

      {!error && chapters && chapters.length > 0 && (
        <div className="space-y-3">
          {chapters.map((group) =>
            group.tests.map((t) => (
              <div key={t.id} className="card hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-4">
                  <div className="text-2xl font-bold text-brand/30 flex-shrink-0 w-10">{String(group.number).padStart(2, "0")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-ink truncate">{group.chapter}</h3>
                      <StatusTag status={t.status} />
                    </div>
                    <p className="text-xs text-ink-soft mb-3">{t.name}</p>
                    <p className="text-xs text-ink-soft mb-3">
                      {t.questionCount} Questions • {t.totalMarks} Marks
                    </p>

                    {mode === "online" ? (
                      <OnlineCta t={t} />
                    ) : (
                      <button
                        onClick={() => handleDownload(t.id)}
                        disabled={downloadingId === t.id}
                        className="btn-secondary text-sm active:scale-[0.97] transition-all duration-150"
                      >
                        {downloadingId === t.id ? "Preparing PDF..." : "↓ Download"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OnlineCta({ t }: { t: TestItem }) {
  if (t.status === "UPCOMING") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-soft">
          Starts {new Date(t.openTime).toLocaleDateString(undefined, { day: "numeric", month: "short" })} •{" "}
          {new Date(t.openTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
    );
  }
  if (t.status === "COMPLETED") {
    return (
      <div className="flex items-center gap-3">
        {t.score !== null && (
          <span className="text-xs text-ink-soft">
            Score: <strong className="text-ink">{t.score}</strong> / {t.totalMarks}
          </span>
        )}
        {t.attemptId && (
          <Link href={`/student/result/${t.attemptId}`} className="btn-secondary text-sm active:scale-[0.97] transition-all duration-150">
            View Result
          </Link>
        )}
      </div>
    );
  }
  if (t.status === "MISSED") {
    return <span className="text-xs text-ink-soft">Test window closed</span>;
  }
  // LIVE / AVAILABLE
  return (
    <Link href={`/student/exam/${t.id}`} className="btn-primary text-sm active:scale-[0.97] transition-all duration-150">
      {t.isInProgress ? "Continue Test" : "Start Test"}
    </Link>
  );
}
