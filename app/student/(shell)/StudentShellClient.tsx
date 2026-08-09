"use client";
import { useState } from "react";
import StudentNav from "./StudentNav";
import NotificationBell from "./NotificationBell";

export default function StudentShellClient({
  studentName,
  children,
}: {
  studentName: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {/* Backdrop — mobile only, closes drawer on tap outside */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-surface-lowest z-50 flex flex-col border-r border-surface-highest/60 shadow-sm transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="px-6 h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Atomic Pathshala" className="w-9 h-9" />
            <span className="font-bold text-lg tracking-tight text-ink">Atomic</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-ink-soft w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div onClick={() => setSidebarOpen(false)}>
          <StudentNav />
        </div>
        <div className="p-4 mt-auto">
          <div className="bg-brand-light p-4 rounded-xl border border-brand/10">
            <p className="text-sm font-semibold text-brand mb-1">Need Help?</p>
            <p className="text-xs text-ink-soft">Contact your batch coordinator for support.</p>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="fixed top-0 left-0 right-0 md:left-64 h-16 md:h-20 bg-surface/80 backdrop-blur-xl z-30 flex items-center justify-between px-3 sm:px-8 border-b border-surface-highest/40">
          <div className="flex items-center gap-2 sm:gap-3 text-ink-soft min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="material-symbols-outlined hidden sm:inline">waving_hand</span>
            <span className="font-semibold truncate text-sm sm:text-base">Welcome back, {studentName.split(" ")[0]}!</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-surface-highest">
              <div className="text-right">
                <p className="font-semibold text-sm text-ink leading-none">{studentName}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center">
                <span className="material-symbols-outlined text-ink-soft text-xl">person</span>
              </div>
            </div>
          </div>
        </header>

        <main className="pt-16 md:pt-20 min-h-screen px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
