"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        device: {
          screenRes: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Login failed");
      return;
    }
    router.push(data.role === "STUDENT" ? "/student" : "/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Atomic Pathshala" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-semibold text-slate-900">Atomic Test Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Link href="/forgot-password" className="text-xs text-brand mt-1 inline-block">Forgot password?</Link>
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-center text-sm text-slate-500">
            New student? <Link href="/register" className="text-brand font-medium">Create an account</Link>
          </p>
          <p className="text-center text-xs text-slate-400">
            Entering an exam hall? <Link href="/test-login" className="text-brand font-medium">Use Test Login →</Link>
          </p>
        </form>
        <p className="text-center text-xs text-slate-400 mt-4">
          Seed accounts: admin@atp.test / student@atp.test (password: <code>password123</code>)
        </p>
      </div>
    </main>
  );
}
