"use client";
import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  subject: string | null;
  createdAt: string;
};

const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "TEACHER", subject: "Physics" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [usersRes, meRes] = await Promise.all([fetch("/api/users"), fetch("/api/me")]);
    setUsers(await usersRes.json());
    // /api/me only returns name today; role is inferred by what the page loaded successfully — fine for MVP display
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Failed to create user");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "TEACHER", subject: "Physics" });
    load();
  }

  const roleBadge: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-100 text-purple-700",
    SUB_ADMIN: "bg-blue-100 text-blue-700",
    TEACHER: "bg-green-100 text-green-700",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">User Management</h1>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        Create Sub Admin, Teacher, or Student accounts. Permission always flows top → bottom: a Sub
        Admin can create Teachers and Students, but not other Sub Admins or a Super Admin.
      </p>

      <form onSubmit={handleCreate} className="card grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 items-end max-w-4xl">
        {error && <div className="col-span-full text-sm text-danger">{error}</div>}
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="SUB_ADMIN">Sub Admin</option>
            <option value="TEACHER">Teacher</option>
            <option value="STUDENT">Student</option>
          </select>
        </div>
        {form.role === "TEACHER" ? (
          <div>
            <label className="label">Subject</label>
            <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Creating..." : "Create User"}
        </button>
      </form>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-6">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-800">{u.name}</td>
                  <td className="py-2 pr-4 text-slate-500">{u.email}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge[u.role] || "bg-slate-100"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{u.subject || "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No staff accounts yet besides yourself.
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
