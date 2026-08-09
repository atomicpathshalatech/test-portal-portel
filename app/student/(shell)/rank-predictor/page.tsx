"use client";
import { useState } from "react";
import Link from "next/link";

type Prediction = {
  estimatedRank: number;
  rankRangeLow: number;
  rankRangeHigh: number;
  confidence: "high" | "medium" | "low";
  marksEntered: number;
  category: string;
  disclaimer: string;
};

type CollegeRow = {
  rank: number;
  quota: string;
  instituteName: string;
  course: string;
  allottedCategory: string;
  candidateCategory: string;
  remarks: string | null;
};

type CollegeResult = {
  year: number;
  rankEntered: number;
  category: string;
  course: string;
  results: CollegeRow[];
  disclaimer: string;
};

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];
const COURSES = ["Any", "MBBS", "BDS", "B.Sc Nursing"];

export default function RankPredictorPage() {
  const [tab, setTab] = useState<"marks" | "college">("marks");

  // Marks -> Rank
  const [marks, setMarks] = useState("");
  const [category, setCategory] = useState("General");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Rank -> College
  const [rank, setRank] = useState("");
  const [collegeCategory, setCollegeCategory] = useState("General");
  const [course, setCourse] = useState("Any");
  const [collegeResult, setCollegeResult] = useState<CollegeResult | null>(null);
  const [collegeError, setCollegeError] = useState("");
  const [collegeLoading, setCollegeLoading] = useState(false);

  async function handlePredict(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    const res = await fetch(`/api/rank-predictor?marks=${marks}&category=${category}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Could not predict rank");
      return;
    }
    setResult(data);
  }

  async function handleCollegeSearch(e: React.FormEvent) {
    e.preventDefault();
    setCollegeError("");
    setCollegeResult(null);
    setCollegeLoading(true);
    const params = new URLSearchParams({ rank, category: collegeCategory });
    if (course !== "Any") params.set("course", course);
    const res = await fetch(`/api/college-predictor?${params.toString()}`);
    const data = await res.json();
    setCollegeLoading(false);
    if (!res.ok) {
      setCollegeError(data.message || "Could not fetch college data");
      return;
    }
    setCollegeResult(data);
  }

  const confidenceLabel: Record<string, string> = {
    high: "High confidence (close to known data)",
    medium: "Moderate confidence (interpolated)",
    low: "Low confidence (outside known data range)",
  };

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto">
        <Link href="/student" className="text-sm text-brand mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Rank Predictor</h1>
        <p className="text-slate-500 text-sm mb-6">
          Estimate your likely All-India Rank, or see which colleges previous ranks got in AIQ counselling.
        </p>

        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setTab("marks")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "marks" ? "border-brand text-brand" : "border-transparent text-slate-500"
            }`}
          >
            Marks → Rank
          </button>
          <button
            onClick={() => setTab("college")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "college" ? "border-brand text-brand" : "border-transparent text-slate-500"
            }`}
          >
            Rank → College
          </button>
        </div>

        {tab === "marks" && (
          <div className="max-w-md">
            <form onSubmit={handlePredict} className="card space-y-4">
              {error && <div className="text-sm text-danger">{error}</div>}
              <div>
                <label className="label">Marks (out of 720)</label>
                <input
                  className="input"
                  type="number"
                  required
                  min={0}
                  max={720}
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  placeholder="e.g. 620"
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Calculating..." : "Predict My Rank"}
              </button>
            </form>

            {result && (
              <div className="card mt-4 text-center">
                <div className="text-xs text-slate-400 mb-1">Estimated All-India Rank</div>
                <div className="text-3xl font-bold text-brand">
                  {result.rankRangeLow.toLocaleString()} – {result.rankRangeHigh.toLocaleString()}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  Most likely around <strong>{result.estimatedRank.toLocaleString()}</strong>
                </div>
                <div className="text-xs text-slate-400 mt-3">{confidenceLabel[result.confidence]}</div>
                <div className="text-xs text-slate-400 mt-4 border-t pt-3">{result.disclaimer}</div>
              </div>
            )}
          </div>
        )}

        {tab === "college" && (
          <div>
            <form onSubmit={handleCollegeSearch} className="card grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              {collegeError && <div className="text-sm text-danger sm:col-span-3">{collegeError}</div>}
              <div>
                <label className="label">Your AIR (rank)</label>
                <input
                  className="input"
                  type="number"
                  required
                  min={1}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="e.g. 4500"
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={collegeCategory} onChange={(e) => setCollegeCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Course</label>
                <select className="input" value={course} onChange={(e) => setCourse(e.target.value)}>
                  {COURSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary sm:col-span-3" disabled={collegeLoading}>
                {collegeLoading ? "Searching..." : "See Nearby Allotments"}
              </button>
            </form>

            {collegeResult && (
              <div className="card mt-4">
                <div className="text-sm text-slate-500 mb-3">
                  Showing {collegeResult.year} AIQ Round 1 allotments nearest to rank{" "}
                  <strong>{collegeResult.rankEntered.toLocaleString()}</strong>
                  {collegeResult.category !== "Any" ? ` (${collegeResult.category})` : ""}
                  {collegeResult.course !== "Any" ? `, ${collegeResult.course}` : ""}
                </div>
                {collegeResult.results.length === 0 ? (
                  <p className="text-slate-400 text-sm">No nearby allotments found for this filter combination.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-1 pr-2">Rank</th>
                          <th className="py-1 pr-2">Institute</th>
                          <th className="py-1 pr-2">Course</th>
                          <th className="py-1 pr-2">Quota</th>
                          <th className="py-1 pr-2">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collegeResult.results.map((r, i) => (
                          <tr
                            key={i}
                            className={`border-b last:border-0 ${
                              Math.abs(r.rank - collegeResult.rankEntered) < 50 ? "bg-amber-50" : ""
                            }`}
                          >
                            <td className="py-1 pr-2 whitespace-nowrap">{r.rank.toLocaleString()}</td>
                            <td className="py-1 pr-2">{r.instituteName}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{r.course}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{r.quota}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{r.candidateCategory}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-4 border-t pt-3">{collegeResult.disclaimer}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
