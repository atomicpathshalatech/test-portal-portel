import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminTier, isManagerTier } from "@/lib/permissions";
import AdminNav from "./AdminNav";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SUB_ADMIN: "Sub Admin",
  TEACHER: "Teacher",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // CRITICAL: this was previously missing entirely — any logged-in user
  // (including students navigating directly to /admin/...) could reach the
  // whole admin panel. Every admin route now goes through this guard.
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    redirect("/");
  }

  const manager = isManagerTier(session.role);

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed left-0 top-0 h-full w-64 bg-brand-dark z-50 flex flex-col shadow-xl">
        <div className="px-6 h-20 flex items-center gap-2 flex-shrink-0">
          <img src="/logo.png" alt="Atomic Pathshala" className="w-9 h-9 rounded-lg" />
          <span className="font-bold text-lg tracking-tight text-white">Atomic ATP</span>
        </div>
        <AdminNav manager={manager} />
        <div className="p-4 flex-shrink-0">
          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-lg">person</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session.name}</p>
              <p className="text-xs text-white/60">{ROLE_LABEL[session.role]}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-20 bg-surface/80 backdrop-blur-xl z-40 flex items-center justify-between px-8 border-b border-surface-highest/40">
          <div className="flex items-center gap-2 text-ink-soft">
            <span className="material-symbols-outlined text-brand">admin_panel_settings</span>
            <span className="font-semibold text-ink">{ROLE_LABEL[session.role]} Console</span>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-full bg-brand-light text-brand font-medium">
            {session.name}
          </div>
        </header>

        <main className="pt-20 min-h-screen px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
