"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Entry = {
  rank: number;
  overallRank: number | null;
  studentId: string;
  name: string;
  state: string | null;
  city: string | null;
  institute: string | null;
  batch: string | null;
  score: number | null;
  isMe: boolean;
};
type FilterOptions = { states: string[]; cities: string[]; institutes: string[]; batches: string[] };
type LeaderboardData = { entries: Entry[]; filterOptions: FilterOptions };

export default function LeaderboardPage() {
  const { testId } = useParams<{ testId: string }>();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [filters, setFilters] = useState({ state: "", city: "", institute: "", batch: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/tests/${testId}/leaderboard?${params.toString()}`);
    setData(await res.json());
    setLoading(false);
  }, [testId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const filterConfig: { key: keyof typeof filters; label: string; options: string[] }[] = data
    ? [
        { key: "state", label: "State", options: data.filterOptions.states },
        { key: "city", label: "City", options: data.filterOptions.cities },
        { key: "institute", label: "Institute", options: data.filterOptions.institutes },
        { key: "batch", label: "Batch", options: data.filterOptions.batches },
      ]
    : [];

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto">
        <Link href="/student" className="text-sm text-brand mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Leaderboard</h1>
        <p className="text-slate-500 text-sm mb-6">See how you rank against other students on this test.</p>

        {data && data.filterOptions && (
          <div className="card mb-4 flex flex-wrap gap-3">
            {filterConfig.map(
              (f) =>
                f.options.length > 0 && (
                  <div key={f.key}>
                    <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                    <select
                      className="input py-1 text-sm"
                      value={filters[f.key]}
                      onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                    >
                      <option value="">All</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                )
            )}
            {Object.values(filters).some(Boolean) && (
              <button
                onClick={() => setFilters({ state: "", city: "", institute: "", batch: "" })}
                className="text-xs text-brand self-end pb-1 hover:underline transition-all duration-150"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="card overflow-x-auto">
          {loading ? (
            <div className="text-center text-slate-400 py-6">Loading...</div>
          ) : !data || data.entries.length === 0 ? (
            <div className="text-center text-slate-400 py-6">No submissions match this filter yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Institute / Batch</th>
                  <th className="py-2 pr-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr
                    key={e.studentId}
                    className={`border-b last:border-0 ${e.isMe ? "bg-brand-light" : ""}`}
                  >
                    <td className="py-2 pr-4 font-semibold">
                      {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}
                    </td>
                    <td className="py-2 pr-4">
                      {e.name} {e.isMe && <span className="text-xs text-brand font-medium">(You)</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-500 text-xs">
                      {[e.institute, e.batch].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">{e.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
