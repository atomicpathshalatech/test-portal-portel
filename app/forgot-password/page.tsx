"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="card max-w-sm w-full">
        <h1 className="text-xl font-bold text-ink mb-1">Forgot Password?</h1>
        <p className="text-ink-soft text-sm mb-6">Enter your registered email — we'll send you a reset link.</p>

        {done ? (
          <div className="text-center">
            <div className="text-3xl mb-3">📧</div>
            <p className="text-sm text-ink-soft mb-6">
              If an account exists with <strong>{email}</strong>, a password reset link has been sent. Check your inbox (and spam folder).
            </p>
            <Link href="/" className="btn-primary w-full inline-block">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <p className="text-center text-sm text-ink-soft">
              <Link href="/" className="text-brand font-medium">← Back to Login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
