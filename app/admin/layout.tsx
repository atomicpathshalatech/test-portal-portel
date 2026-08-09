import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminTier, isManagerTier } from "@/lib/permissions";
import AdminShellClient from "./AdminShellClient";

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
    <AdminShellClient userName={session.name} role={session.role} manager={manager}>
      {children}
    </AdminShellClient>
  );
}
