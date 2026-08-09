"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/student", label: "Dashboard", icon: "dashboard" },
  { href: "/student/schedule", label: "Schedule", icon: "calendar_month" },
  { href: "/student/dpp", label: "DPP", icon: "today" },
  { href: "/student/results", label: "Results", icon: "bar_chart" },
  { href: "/student/rank-tracker", label: "Rank Tracker", icon: "trophy" },
  { href: "/student/bookmarks", label: "Bookmarks", icon: "bookmark" },
  { href: "/student/ai-coach", label: "AI Coach", icon: "psychology" },
  { href: "/student/rank-predictor", label: "Rank Predictor", icon: "target" },
  { href: "/profile", label: "My Profile", icon: "account_circle" },
];

export default function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-2 space-y-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
              active
                ? "bg-brand text-white font-semibold shadow-md"
                : "text-ink-soft hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
