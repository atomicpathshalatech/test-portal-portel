"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTestSeriesPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", tags: "", targetBatch: "" });
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.message || "Thumbnail upload failed");
      return;
    }
    setThumbnailUrl(data.url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/test-series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, thumbnailUrl }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to create");
      return;
    }
    router.push("/admin/test-series");
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">New Test Series</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <div className="text-sm text-danger">{error}</div>}
        <div>
          <label className="label">Series Name</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="NEET 2027 Test Series"
          />
          <p className="text-xs text-slate-400 mt-1">
            A unique code (e.g. TS-{new Date().getFullYear()}-00001) will be generated automatically.
          </p>
        </div>
        <div>
          <label className="label">Target Batch</label>
          <input
            className="input"
            value={form.targetBatch}
            onChange={(e) => setForm({ ...form, targetBatch: e.target.value })}
            placeholder="Dropper 2027"
          />
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="NEET, Full Syllabus, 2027"
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Thumbnail (optional)</label>
          {thumbnailUrl ? (
            <div className="relative inline-block">
              <img src={thumbnailUrl} alt="" className="h-24 rounded-lg border" />
              <button
                type="button"
                onClick={() => setThumbnailUrl(null)}
                className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs font-bold hover:scale-110 active:scale-90 transition-transform duration-150"
              >
                ✕
              </button>
            </div>
          ) : (
            <input type="file" accept="image/*" onChange={handleThumbnailUpload} disabled={uploading} className="text-sm" />
          )}
        </div>
        <button className="btn-primary w-full" disabled={loading || uploading}>
          {loading ? "Creating..." : "Create Series"}
        </button>
      </form>
    </div>
  );
}
