"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";

type ReportDetail = {
  id: string;
  reasonTags: string;
  comment: string | null;
  screenshotUrl: string | null;
  priority: string;
  status: string;
  createdAt: string;
  teacherNotes: string | null;
  reportedBy: { name: string; email: string };
  claimedBy: { name: string } | null;
  question: {
    id: string;
    questionCode: string | null;
    subject: string;
    translations: { language: string; statement: string; options: { id: string; text: string }[]; correctOptionIds: string[]; solution: string | null }[];
  };
};

export default function ReportDetailPage() {
  const { id: reportId } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/reports/${reportId}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d);
        setNotes(d.teacherNotes || "");
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [reportId]);

  async function doAction(action: string) {
    setSaving(true);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, teacherNotes: notes }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Action failed");
      return;
    }
    load();
  }

  if (loading || !report) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  const t = report.question.translations.find((tr) => tr.language === "en") || report.question.translations[0];

  return (
    <div className="max-w-2xl">
      <Link href="/admin/reports" className="text-sm text-brand mb-2 inline-block hover:opacity-70 transition-opacity duration-150">
        ← All Reports
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">
        Report — <span className="font-mono text-brand">{report.question.questionCode}</span>
      </h1>
      <p className="text-slate-500 text-sm mb-6">
        Reported by {report.reportedBy.name} on {new Date(report.createdAt).toLocaleString()}
      </p>

      <div className="card mb-4">
        <div className="text-xs text-slate-400 mb-1">Issue(s)</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {report.reasonTags.split(",").map((tag) => (
            <span key={tag} className="text-xs px-2 py-1 rounded-full bg-red-50 text-danger">{tag.replace(/_/g, " ")}</span>
          ))}
        </div>
        {report.comment && (
          <>
            <div className="text-xs text-slate-400 mb-1">Student Comment</div>
            <p className="text-sm text-slate-700 mb-3">{report.comment}</p>
          </>
        )}
        {report.screenshotUrl && <img src={report.screenshotUrl} alt="" className="max-h-48 rounded-lg border" />}
      </div>

      <div className="card mb-4">
        <div className="text-xs text-slate-400 mb-2">Question</div>
        <p className="text-sm text-slate-800 mb-3"><FormulaText text={t?.statement || ""} /></p>
        <div className="space-y-1">
          {t?.options.map((opt) => (
            <div key={opt.id} className={`text-sm px-3 py-2 rounded-lg ${t.correctOptionIds.includes(opt.id) ? "bg-green-50 text-success font-medium" : "bg-slate-50"}`}>
              {opt.id}. <FormulaText text={opt.text} />
            </div>
          ))}
        </div>
        {t?.solution && (
          <div className="mt-3 pt-3 border-t text-sm text-slate-600">
            <FormulaText text={t.solution} />
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-800">
            Status: <span className="text-brand">{report.status}</span>
            {report.claimedBy && <span className="text-slate-400 text-xs"> · Claimed by {report.claimedBy.name}</span>}
          </span>
        </div>

        <textarea
          className="input mb-3 text-sm"
          rows={2}
          placeholder="Teacher notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          {report.status === "NEW" && (
            <button onClick={() => doAction("claim")} disabled={saving} className="btn-primary text-sm">
              Claim Report
            </button>
          )}
          {report.status === "CLAIMED" && (
            <>
              <Link href={`/admin/questions/new?edit=${report.question.id}`} className="btn-secondary text-sm">
                ✎ Edit Question
              </Link>
              <button onClick={() => doAction("release")} disabled={saving} className="text-xs text-slate-400 underline hover:opacity-70 transition-opacity duration-150">
                Release Claim
              </button>
              <button onClick={() => doAction("resolve")} disabled={saving} className="bg-success text-white px-4 py-2 rounded-lg text-sm shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100">
                ✓ Mark Resolved
              </button>
              <button onClick={() => doAction("reject")} disabled={saving} className="bg-danger text-white px-4 py-2 rounded-lg text-sm shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:active:scale-100">
                ✗ Reject Report
              </button>
            </>
          )}
          {(report.status === "RESOLVED" || report.status === "REJECTED") && (
            <span className="text-xs text-slate-400">This report has been closed.</span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Link href={`/admin/questions/versions/${report.question.id}`} className="text-xs text-purple-600 underline hover:opacity-70 transition-opacity duration-150">
          View Version History →
        </Link>
      </div>
    </div>
  );
}
