"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function load() {
      fetch("/api/notifications/unread-count")
        .then((r) => r.json())
        .then((d) => setCount(d.count || 0));
    }
    load();
    const interval = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/student/notifications"
      className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:text-brand transition-colors relative"
    >
      <span className="material-symbols-outlined">notifications</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
