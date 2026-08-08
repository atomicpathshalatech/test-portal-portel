"use client";
import { useEffect, useState } from "react";

type Point = { id: string; category: string; marks: number; expectedRank: number; year: number };

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

export default function RankTrendAdminPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [form, setForm] = useState({ category: "General", marks: "", expectedRank: "", year: "2026" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/rank-trend");
    setPoints(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.marks || !form.expectedRank) {
      setError("Marks and Expected Rank are required");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/rank-trend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to save");
      return;
    }
    setForm({ ...form, marks: "", expectedRank: "" });
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rank-trend/${id}`, { method: "DELETE" });
    load();
  }

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    points: points.filter((p) => p.category === cat).sort((a, b) => b.marks - a.marks),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Rank Predictor — Trend Data</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        Enter previous-year (or mock-test cohort) marks-vs-rank data points here. The Rank Predictor
        interpolates between these points to estimate a student's likely rank — the more points you add
        across the marks range, the more accurate the estimate. This is not an official NTA source; update
        it every year with the latest published cutoff/rank data.
      </p>

      <form onSubmit={handleSubmit} className="card grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 items-end">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Marks</label>
          <input
            className="input"
            type="number"
            value={form.marks}
            onChange={(e) => setForm({ ...form, marks: e.target.value })}
            placeholder="650"
          />
        </div>
        <div>
          <label className="label">Expected Rank</label>
          <input
            className="input"
            type="number"
            value={form.expectedRank}
            onChange={(e) => setForm({ ...form, expectedRank: e.target.value })}
            placeholder="4500"
          />
        </div>
        <div>
          <label className="label">Year</label>
          <input
            className="input"
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
          />
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Add / Update Point"}
        </button>
      </form>
      {error && <div className="text-sm text-danger mb-4">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {grouped.map((g) => (
          <div key={g.category} className="card">
            <h2 className="font-semibold text-slate-900 mb-3">{g.category}</h2>
            {g.points.length === 0 ? (
              <p className="text-slate-400 text-sm">No data points yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-1">Marks</th>
                    <th className="py-1">Expected Rank</th>
                    <th className="py-1">Year</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.points.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1">{p.marks}</td>
                      <td className="py-1">{p.expectedRank.toLocaleString()}</td>
                      <td className="py-1">{p.year}</td>
                      <td className="py-1">
                        <button onClick={() => handleDelete(p.id)} className="text-danger text-xs">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
