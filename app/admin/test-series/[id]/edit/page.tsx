"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditTestSeriesPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({ name: "", code: "", description: "", tags: "", targetBatch: "" });
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    fetch(`/api/test-series/${id}`)
      .then((r) => r.json())
      .then((s) => {
        setForm({
          name: s.name || "",
          code: s.code || "",
          description: s.description || "",
          tags: s.tags || "",
          targetBatch: s.targetBatch || "",
        });
        setThumbnailUrl(s.thumbnailUrl || null);
        setLoadingExisting(false);
      });
  }, [id]);

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
    const res = await fetch(`/api/test-series/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, thumbnailUrl }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to update");
      return;
    }
    router.push(`/admin/test-series/${id}`);
  }

  if (loadingExisting) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Edit Test Series</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && <div className="text-sm text-danger">{error}</div>}
        <div>
          <label className="label">Series Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Series Code</label>
          <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <label className="label">Target Batch</label>
          <input className="input" value={form.targetBatch} onChange={(e) => setForm({ ...form, targetBatch: e.target.value })} />
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Thumbnail</label>
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
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={loading || uploading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.push(`/admin/test-series/${id}`)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
