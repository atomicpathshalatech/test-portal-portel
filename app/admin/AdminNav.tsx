"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

const BASE_LINKS: NavItem[] = [{ href: "/admin", label: "Dashboard", icon: "dashboard" }];

const MANAGER_LINKS_TOP: NavItem[] = [
  { href: "/admin/users", label: "User Management", icon: "group" },
  { href: "/admin/test-series", label: "Test Series", icon: "collections_bookmark" },
  { href: "/admin/test-templates", label: "Test Templates", icon: "content_copy" },
];

const SHARED_LINKS: NavItem[] = [
  { href: "/admin/questions", label: "Question Bank", icon: "database" },
  { href: "/admin/tests", label: "Manage Tests", icon: "assignment" },
  { href: "/admin/dpps", label: "DPPs", icon: "today" },
  { href: "/admin/reports", label: "Question Reports", icon: "flag" },
];

const MANAGER_LINKS_BOTTOM: NavItem[] = [
  { href: "/admin/security", label: "Security Center", icon: "shield" },
  { href: "/admin/device-sessions", label: "Device Sessions", icon: "devices" },
  { href: "/admin/rank-trend", label: "Rank Predictor Data", icon: "target" },
  { href: "/admin/notifications", label: "Send Notification", icon: "notifications" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: "history" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
        active ? "bg-white/15 text-white font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="material-symbols-outlined text-lg">{item.icon}</span>
      {item.label}
    </Link>
  );
}

export default function AdminNav({ manager }: { manager: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      {BASE_LINKS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}

      {manager && (
        <>
          <div className="h-px bg-white/10 my-3 mx-3" />
          {MANAGER_LINKS_TOP.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </>
      )}

      <div className="h-px bg-white/10 my-3 mx-3" />
      {SHARED_LINKS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}

      {manager && (
        <>
          <div className="h-px bg-white/10 my-3 mx-3" />
          {MANAGER_LINKS_BOTTOM.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </>
      )}
    </nav>
  );
}
