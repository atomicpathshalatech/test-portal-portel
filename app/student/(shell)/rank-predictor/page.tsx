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

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

export default function RankPredictorPage() {
  const [marks, setMarks] = useState("");
  const [category, setCategory] = useState("General");
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const confidenceLabel: Record<string, string> = {
    high: "High confidence (close to known data)",
    medium: "Moderate confidence (interpolated)",
    low: "Low confidence (outside known data range)",
  };

  return (
    <div className="w-full">
      <div className="max-w-md mx-auto">
        <Link href="/student" className="text-sm text-brand mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Rank Predictor</h1>
        <p className="text-slate-500 text-sm mb-6">
          Estimate your likely All-India Rank based on previous-year trends.
        </p>

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
    </div>
  );
}
