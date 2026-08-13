"use client";
import { useState } from "react";
import Link from "next/link";
import AdminNav from "./AdminNav";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SUB_ADMIN: "Sub Admin",
  TEACHER: "Teacher",
};

export default function AdminShellClient({
  userName,
  role,
  manager,
  children,
}: {
  userName: string;
  role: string;
  manager: boolean;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-brand-dark z-50 flex flex-col shadow-xl transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="px-6 h-20 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Atomic Pathshala" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-lg tracking-tight text-white">Atomic ATP</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/70 w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div onClick={() => setSidebarOpen(false)} className="flex-1 overflow-y-auto">
          <AdminNav manager={manager} />
        </div>
        <div className="p-4 flex-shrink-0">
          <Link href="/profile" className="bg-white/10 hover:bg-white/15 transition-colors duration-150 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-lg">person</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-white/60">{ROLE_LABEL[role]}</p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="fixed top-0 left-0 right-0 md:left-64 h-16 md:h-20 bg-surface/80 backdrop-blur-xl z-30 flex items-center justify-between px-3 sm:px-8 border-b border-surface-highest/40">
          <div className="flex items-center gap-2 text-ink-soft min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="material-symbols-outlined text-brand hidden sm:inline">admin_panel_settings</span>
            <span className="font-semibold text-ink truncate text-sm sm:text-base">{ROLE_LABEL[role]} Console</span>
          </div>
          <div className="text-[11px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-full bg-brand-light text-brand font-medium truncate max-w-[100px] sm:max-w-none flex-shrink-0">
            {userName}
          </div>
        </header>

        <main className="pt-16 md:pt-20 min-h-screen px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
