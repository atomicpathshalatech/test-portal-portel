"use client";
import { useEffect, useState } from "react";

type StudentRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  studentIdCode: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  category: string | null;
  subCategory: string | null;
  course: string | null;
  createdAt: string;
  isActive: boolean;
};

function toCsvValue(v: string | null | undefined) {
  const s = v ?? "";
  // Quote and escape anything that could break a CSV cell (commas, quotes, newlines)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: StudentRow[]) {
  const headers = [
    "Student ID",
    "Name",
    "Email",
    "Mobile",
    "Gender",
    "Date of Birth",
    "State",
    "City",
    "Category",
    "Sub-category",
    "Course",
    "Registered On",
    "Status",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        toCsvValue(r.studentIdCode),
        toCsvValue(r.name),
        toCsvValue(r.email),
        toCsvValue(r.mobile),
        toCsvValue(r.gender),
        toCsvValue(r.dateOfBirth ? new Date(r.dateOfBirth).toLocaleDateString() : ""),
        toCsvValue(r.state),
        toCsvValue(r.city),
        toCsvValue(r.category),
        toCsvValue(r.subCategory),
        toCsvValue(r.course),
        toCsvValue(new Date(r.createdAt).toLocaleString()),
        toCsvValue(r.isActive ? "Active" : "Inactive"),
      ].join(",")
    ),
  ];
  // Prefix with a UTF-8 BOM so Excel opens names/data with accents correctly.
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `student-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(`/api/users?role=STUDENT${q ? `&search=${encodeURIComponent(q)}` : ""}`);
    setStudents(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Debounce search-as-you-type so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Student Registrations</h1>
        <button
          onClick={() => downloadCsv(students)}
          disabled={students.length === 0}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          ⬇ Export CSV ({students.length})
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        Everyone who has self-registered on the student portal, most recent first. This is separate from{" "}
        <a href="/admin/users" className="text-brand underline hover:opacity-70 transition-opacity duration-150">
          User Management
        </a>
        , which covers staff (Sub Admin / Teacher) accounts you create yourself.
      </p>

      <div className="mb-4 max-w-md">
        <input
          className="input"
          placeholder="Search by name, email, mobile, student ID, city, state, or course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-6">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Student ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Mobile</th>
                <th className="py-2 pr-4">City / State</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Course</th>
                <th className="py-2 pr-4">Registered</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors duration-150">
                  <td className="py-2 pr-4 font-mono text-xs text-slate-500">{s.studentIdCode || "—"}</td>
                  <td className="py-2 pr-4 font-medium text-slate-800">{s.name}</td>
                  <td className="py-2 pr-4 text-slate-500">{s.email}</td>
                  <td className="py-2 pr-4 text-slate-500">{s.mobile || "—"}</td>
                  <td className="py-2 pr-4 text-slate-500">
                    {s.city || "—"}
                    {s.state ? `, ${s.state}` : ""}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {s.category || "—"}
                    {s.subCategory && s.subCategory !== "None" && (
                      <div className="text-xs text-slate-400">{s.subCategory}</div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{s.course || "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.isActive ? "bg-green-100 text-success" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    {search ? "No students match that search." : "No students have registered yet."}
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
