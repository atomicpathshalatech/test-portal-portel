"use client";
import { useEffect, useState } from "react";

type ReportRow = {
  id: string;
  reasonTags: string;
  comment: string | null;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  teacherNotes: string | null;
  question: { questionCode: string | null; subject: string };
};

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-success",
  REJECTED: "bg-red-100 text-danger",
};

const REASON_LABELS: Record<string, string> = {
  WRONG_ANSWER: "Wrong Answer",
  INCORRECT_QUESTION: "Incorrect Question",
  IMAGE_MISSING: "Image Missing",
  TYPO: "Typo",
  WRONG_OPTION: "Wrong Option",
  WRONG_SOLUTION: "Wrong Solution",
  LANGUAGE_ISSUE: "Language Issue",
  OUT_OF_SYLLABUS: "Out of Syllabus",
  DUPLICATE_QUESTION: "Duplicate Question",
  OTHER: "Other",
};

export default function MyReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        setReports(d);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col w-full gap-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">My Reports</h1>
        <p className="text-ink-soft mt-2">Question issues you've reported and their review status.</p>
      </div>

      {loading ? (
        <div className="card text-center text-ink-soft">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="card text-center text-ink-soft">
          You haven't reported any questions yet. Found a problem with a question? Use "Report Question" wherever you see it.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    {r.question.questionCode || "Question"} · {r.question.subject}
                  </div>
                  <div className="font-medium text-ink">
                    {r.reasonTags
                      .split(",")
                      .map((t) => REASON_LABELS[t] || t)
                      .join(", ")}
                  </div>
                  {r.comment && <p className="text-sm text-ink-soft mt-1">{r.comment}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_STYLE[r.status] || STATUS_STYLE.NEW}`}>
                  {r.status.replace("_", " ")}
                </span>
              </div>
              {r.status === "RESOLVED" && r.teacherNotes && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <span className="text-slate-400">Response: </span>
                  <span className="text-ink-soft">{r.teacherNotes}</span>
                </div>
              )}
              <p className="text-xs text-ink-soft/70 mt-3">
                Reported {new Date(r.createdAt).toLocaleDateString()}
                {r.resolvedAt && ` · Resolved ${new Date(r.resolvedAt).toLocaleDateString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
