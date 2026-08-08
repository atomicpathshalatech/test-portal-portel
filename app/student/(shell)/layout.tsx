import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import StudentNav from "./StudentNav";
import NotificationBell from "./NotificationBell";

export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") redirect("/");

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-lowest z-50 flex flex-col border-r border-surface-highest/60 shadow-sm">
        <div className="px-6 h-20 flex items-center gap-2">
          <img src="/logo.png" alt="Atomic Pathshala" className="w-9 h-9" />
          <span className="font-bold text-lg tracking-tight text-ink">Atomic</span>
        </div>
        <StudentNav />
        <div className="p-4 mt-auto">
          <div className="bg-brand-light p-4 rounded-xl border border-brand/10">
            <p className="text-sm font-semibold text-brand mb-1">Need Help?</p>
            <p className="text-xs text-ink-soft">Contact your batch coordinator for support.</p>
          </div>
        </div>
      </aside>

      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-20 bg-surface/80 backdrop-blur-xl z-40 flex items-center justify-between px-8 border-b border-surface-highest/40">
          <div className="flex items-center gap-3 text-ink-soft">
            <span className="material-symbols-outlined">waving_hand</span>
            <span className="font-semibold">Welcome back, {session.name.split(" ")[0]}!</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-3 pl-6 border-l border-surface-highest">
              <div className="text-right">
                <p className="font-semibold text-sm text-ink leading-none">{session.name}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center">
                <span className="material-symbols-outlined text-ink-soft text-xl">person</span>
              </div>
            </div>
          </div>
        </header>

        <main className="pt-20 min-h-screen px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
