"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Bucket = { correct: number; incorrect: number; unattempted: number };
type ResultData = {
  status: string;
  score: number | null;
  rank: number | null;
  totalStudents: number;
  isDpp: boolean;
  testId: string | null;
  dppId: string | null;
  testName: string;
  bySubject: Record<string, Bucket>;
  byDifficulty: Record<string, Bucket>;
};

function Bar({ label, bucket }: { label: string; bucket: Bucket }) {
  const total = bucket.correct + bucket.incorrect + bucket.unattempted || 1;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {bucket.correct}✓ {bucket.incorrect}✗ {bucket.unattempted}—
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
        <div className="bg-success h-full" style={{ width: `${(bucket.correct / total) * 100}%` }} />
        <div className="bg-danger h-full" style={{ width: `${(bucket.incorrect / total) * 100}%` }} />
        <div className="bg-slate-300 h-full" style={{ width: `${(bucket.unattempted / total) * 100}%` }} />
      </div>
    </div>
  );
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then((r) => r.json())
      .then(setData);
  }, [attemptId]);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading result...</div>;

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center">
          <div className="text-sm text-slate-500 flex items-center justify-center gap-2">
            {data.isDpp && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-semibold">DPP</span>}
            {data.testName}
          </div>
          <div className="text-4xl font-bold text-brand mt-2">{data.score ?? "—"}</div>
          <div className="text-slate-500 text-sm">Score</div>
          {!data.isDpp && (
            <div className="flex justify-center gap-8 mt-4">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  {data.rank ?? "—"} / {data.totalStudents}
                </div>
                <div className="text-xs text-slate-500">Rank</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mt-4">
            {!data.isDpp && (
              <>
                <Link
                  href={`/student/leaderboard/${data.testId}`}
                  className="btn-secondary inline-block text-sm"
                >
                  🏆 View Leaderboard
                </Link>
                <a
                  href={`/api/attempts/${attemptId}/certificate`}
                  className="btn-secondary inline-block text-sm"
                >
                  🎓 Download Certificate
                </a>
              </>
            )}
            {data.isDpp && (
              <Link href="/student/dpp" className="btn-secondary inline-block text-sm">
                ← Back to DPPs
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Subject-wise Performance</h2>
          {Object.entries(data.bySubject).map(([subject, bucket]) => (
            <Bar key={subject} label={subject} bucket={bucket} />
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Difficulty-wise Performance</h2>
          {["EASY", "MEDIUM", "HARD"].map((d) => (
            <Bar key={d} label={d} bucket={data.byDifficulty[d] || { correct: 0, incorrect: 0, unattempted: 0 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
