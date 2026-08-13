import Link from "next/link";

export default function MyTestsHomePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink mb-1">My Tests</h1>
      <p className="text-ink-soft text-sm mb-8">Choose how you want to practice</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/student/my-tests/online" className="card-interactive flex items-start gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center text-2xl flex-shrink-0">
            📝
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ink">Attempt Online</h3>
            <p className="text-xs text-ink-soft mt-0.5">Take tests directly</p>
          </div>
          <span className="material-symbols-outlined text-ink-soft opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-150 flex-shrink-0">
            arrow_forward
          </span>
        </Link>

        <Link href="/student/my-tests/pdf" className="card-interactive flex items-start gap-4 group">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center text-2xl flex-shrink-0">
            📄
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ink">Download PDF</h3>
            <p className="text-xs text-ink-soft mt-0.5">Practice with paper</p>
          </div>
          <span className="material-symbols-outlined text-ink-soft opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-150 flex-shrink-0">
            arrow_forward
          </span>
        </Link>
      </div>
    </div>
  );
}
