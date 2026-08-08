"use client";
import { useState } from "react";

export default function AdminNotificationsPage() {
  const [form, setForm] = useState({ title: "", message: "", target: "ALL_STUDENTS" });
  const [customEmail, setCustomEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSending(true);
    const target = form.target === "CUSTOM" ? customEmail : form.target;
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, target }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.message || "Failed to send");
      return;
    }
    setSuccess(`Sent to ${data.sent} student${data.sent > 1 ? "s" : ""}.`);
    setForm({ title: "", message: "", target: "ALL_STUDENTS" });
    setCustomEmail("");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Send Notification</h1>
      <p className="text-slate-500 text-sm mb-6">
        Broadcast an announcement to all students, or send a targeted message to one student by email.
        (Test-publish notifications are sent automatically — this is for everything else.)
      </p>

      <form onSubmit={handleSend} className="card space-y-4">
        {error && <div className="text-sm text-danger">{error}</div>}
        {success && <div className="text-sm text-success">{success}</div>}

        <div>
          <label className="label">Send To</label>
          <select className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
            <option value="ALL_STUDENTS">All Students</option>
            <option value="CUSTOM">Specific student (enter email)</option>
          </select>
          {form.target === "CUSTOM" && (
            <input
              className="input mt-2"
              type="email"
              placeholder="student@example.com"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              required
            />
          )}
        </div>
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Test schedule changed"
            required
          />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            className="input"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
          />
        </div>
        <button className="btn-primary" disabled={sending}>
          {sending ? "Sending..." : "Send Notification"}
        </button>
      </form>
    </div>
  );
}
