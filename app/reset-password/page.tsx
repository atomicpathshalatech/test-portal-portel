"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const POLICY_CHECKS = [
  {
    label: "At least 8 characters",
    test: (p: string) => p.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    label: "One lowercase letter",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    label: "One number",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    label: "One special character",
    test: (p: string) =>
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
];

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordChecks = POLICY_CHECKS.map((c) => ({
    ...c,
    passed: c.test(password),
  }));

  const passwordValid = passwordChecks.every((c) => c.passed);
  const passwordsMatch =
    password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setError("Password doesn't meet all the requirements below.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to reset password");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-6 text-center">
            <h1 className="text-xl font-semibold mb-3">
              Invalid Reset Link
            </h1>

            <p className="text-sm text-slate-600 mb-5">
              This link is missing a reset token. Please request a new one.
            </p>

            <Link
              href="/forgot-password"
              className="btn-primary inline-block"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-6 text-center">
            <div className="text-4xl mb-4">✅</div>

            <h1 className="text-xl font-semibold mb-3">
              Password Reset!
            </h1>

            <p className="text-sm text-slate-600 mb-5">
              You've been logged out of all devices for security. Please log
              in with your new password.
            </p>

            <Link
              href="/login"
              className="btn-primary inline-block"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold mb-2">
            Set a New Password
          </h1>

          <p className="text-sm text-slate-600 mb-6">
            Choose a strong password you haven't used before.
          </p>

          {error && (
            <div className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New Password</label>

              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-1 mt-2">
                {passwordChecks.map((c) => (
                  <div
                    key={c.label}
                    className={`text-xs flex items-center gap-1 ${
                      c.passed
                        ? "text-success"
                        : "text-slate-400"
                    }`}
                  >
                    <span>{c.passed ? "✓" : "○"}</span>
                    {c.label}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                Confirm New Password
              </label>

              <input
                type="password"
                required
                className="input"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />

              {confirmPassword && (
                <div
                  className={`text-xs mt-1 ${
                    passwordsMatch
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {passwordsMatch
                    ? "✓ Passwords match"
                    : "✗ Passwords don't match"}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}