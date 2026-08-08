"use client";
import { useEffect, useState } from "react";

type DeviceSessionRow = {
  id: string;
  userId: string;
  deviceType: string;
  browser: string | null;
  os: string | null;
  screenRes: string | null;
  ipAddress: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  user: { name: string; email: string };
};

const POLICIES = [
  {
    value: "SINGLE_SESSION",
    label: "Single Session Only",
    desc: "Only one device at a time — logging in anywhere logs out the previous device.",
  },
  {
    value: "MOBILE_PLUS_WEB",
    label: "One Mobile + One Web",
    desc: "A student can stay logged in on one phone AND one laptop/desktop simultaneously. A second mobile or second desktop login still logs out the earlier one of that same type.",
  },
  {
    value: "UNLIMITED",
    label: "Unlimited Devices",
    desc: "No restriction — any number of devices can be logged in at once (still logged for audit).",
  },
];

export default function DeviceSessionsPage() {
  const [policy, setPolicy] = useState("SINGLE_SESSION");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<DeviceSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [configRes, sessionsRes] = await Promise.all([
      fetch("/api/security-config"),
      fetch("/api/device-sessions"),
    ]);
    const config = await configRes.json();
    setPolicy(config.policy);
    setSessions(await sessionsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updatePolicy(next: string) {
    setSaving(true);
    await fetch("/api/security-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy: next }),
    });
    setPolicy(next);
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Device Sessions & Multi-Login</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        Every login records a device fingerprint (browser, OS, device type, screen, timezone).
        Sessions no longer permitted under the active policy are logged out automatically — mid-exam
        too, within ~30 seconds.
      </p>

      <div className="card mb-6 max-w-2xl">
        <div className="font-medium text-slate-800 mb-3">Login Policy</div>
        <div className="space-y-2">
          {POLICIES.map((p) => (
            <label
              key={p.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                policy === p.value ? "border-brand bg-brand-light" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="policy"
                checked={policy === p.value}
                onChange={() => updatePolicy(p.value)}
                disabled={saving}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm text-slate-800">{p.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <h2 className="font-semibold text-slate-900 mb-3">Recent Login Sessions</h2>
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-6">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">IP</th>
                <th className="py-2 pr-4">Login Time</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-slate-800">{s.user.name}</div>
                    <div className="text-xs text-slate-400">{s.user.email}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 mr-1">
                      {s.deviceType === "mobile" ? "📱" : "💻"} {s.deviceType}
                    </span>
                    {s.browser} · {s.os} {s.screenRes ? `· ${s.screenRes}` : ""}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{s.ipAddress || "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    {s.revokedAt ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-danger">
                        Logged out ({s.revokedReason})
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-success">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No login sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
