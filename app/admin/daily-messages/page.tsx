"use client";
import { useEffect, useState } from "react";

type Message = {
  id: string;
  type: "MORNING" | "NIGHT";
  title: string;
  body: string;
  enabled: boolean;
  lastSentAt: string | null;
};

const TABS = [
  { value: "MORNING", label: "🌅 Morning Motivation (7:00 AM)" },
  { value: "NIGHT", label: "🌙 Night Check-in (9:00 PM)" },
] as const;

export default function DailyMessagesPage() {
  const [tab, setTab] = useState<"MORNING" | "NIGHT">("MORNING");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    fetch(`/api/daily-messages?type=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.body.trim()) {
      setError("Both title and body are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/daily-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, title: form.title, body: form.body }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.message || "Failed to add message");
      return;
    }
    setForm({ title: "", body: "" });
    load();
  }

  async function toggleEnabled(m: Message) {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: !x.enabled } : x)));
    await fetch(`/api/daily-messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !m.enabled }),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this message? This can't be undone.")) return;
    setMessages((prev) => prev.filter((x) => x.id !== id));
    await fetch(`/api/daily-messages/${id}`, { method: "DELETE" });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Daily Messages</h1>
      <p className="text-slate-500 text-sm mb-6">
        Content shown by the automated Morning Motivation and Night Check-in notifications. One enabled message
        rotates in each day — the least-recently-sent one goes out first, so students don't see repeats.
      </p>

      <div className="flex gap-2 mb-6 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
              tab === t.value ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAdd} className="card space-y-3 mb-6">
        <h2 className="font-semibold text-slate-800 text-sm">Add a new message</h2>
        {error && <div className="text-sm text-danger">{error}</div>}
        <input
          className="input"
          placeholder="Title (e.g. 🌅 Good Morning, Champion!)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="input"
          rows={2}
          placeholder="Body text..."
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <button className="btn-primary text-sm" disabled={saving}>
          {saving ? "Adding..." : "Add Message"}
        </button>
      </form>

      {loading ? (
        <div className="card text-center text-slate-400">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="card text-center text-slate-400">No messages yet — add one above.</div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`card ${!m.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{m.title}</div>
                  <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{m.body}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {m.lastSentAt ? `Last sent ${new Date(m.lastSentAt).toLocaleDateString()}` : "Never sent yet"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input type="checkbox" checked={m.enabled} onChange={() => toggleEnabled(m)} />
                    Enabled
                  </label>
                  <button onClick={() => handleDelete(m.id)} className="text-xs text-danger hover:underline transition-all duration-150">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
