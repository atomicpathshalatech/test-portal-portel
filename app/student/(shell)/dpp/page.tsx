import Link from "next/link";

const SUBJECTS = [
  { name: "Physics", icon: "⚛️", color: "bg-blue-50 text-blue-700" },
  { name: "Chemistry", icon: "🧪", color: "bg-green-50 text-green-700" },
  { name: "Botany", icon: "🌿", color: "bg-emerald-50 text-emerald-700" },
  { name: "Zoology", icon: "🐾", color: "bg-orange-50 text-orange-700" },
];

export default function DppSubjectsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-2">Daily Practice Problems</h1>
      <p className="text-ink-soft text-sm mb-6">Chapter-wise practice sets — sharpen one topic at a time.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SUBJECTS.map((s) => (
          <Link
            key={s.name}
            href={`/student/dpp/${encodeURIComponent(s.name)}`}
            className="card-interactive flex flex-col items-center text-center gap-3 py-8"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${s.color}`}>{s.icon}</div>
            <span className="font-semibold text-ink">{s.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
