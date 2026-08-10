"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} disabled={loading} className={className}>
      <span className="material-symbols-outlined text-lg">logout</span>
      {loading ? "Signing out…" : "Log Out"}
    </button>
  );
}
