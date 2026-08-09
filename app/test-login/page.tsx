"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TestLoginPage() {
  const router = useRouter();
  const [studentIdCode, setStudentIdCode] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [candidate, setCandidate] = useState<{ name: string; photoUrl: string | null } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);
    const res = await fetch("/api/auth/test-login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIdCode, dateOfBirth }),
    });
    const data = await res.json();
    setVerifying(false);
    if (!res.ok) {
      setError(data.message || "Verification failed");
      setCandidate(null);
      return;
    }
    setCandidate({ name: data.name, photoUrl: data.photoUrl });
  }

  async function handleConfirm() {
    setConfirming(true);
    setError("");
    const device = {
      screenRes: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const res = await fetch("/api/auth/test-login/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIdCode, dateOfBirth, device }),
    });
    const data = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(data.message || "Login failed");
      setCandidate(null);
      return;
    }
    router.push("/student");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Candidate verification header — NTA-style */}
      <div className="bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg border-2 border-brand flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-brand text-2xl">badge</span>
          </div>
          <div className="text-xs sm:text-sm">
            <div className="text-slate-500">
              Student Registration:{" "}
              <a href="/register" className="text-brand font-semibold underline">
                New here? Register
              </a>
            </div>
            <div className="text-brand font-medium text-[11px] sm:text-xs mt-0.5">
              [Contact Invigilator if the Name and Photograph displayed below is not yours]
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs sm:text-sm">
            <div className="text-slate-700">
              Candidate Name: <span className="text-brand font-semibold">{candidate ? candidate.name : "[Enter details below]"}</span>
            </div>
            <div className="text-slate-700">
              Exam Type: <span className="text-brand font-semibold">NEET 2027</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg border-2 border-brand overflow-hidden flex items-center justify-center flex-shrink-0 bg-slate-50">
            {candidate?.photoUrl ? (
              <img src={candidate.photoUrl} alt="Candidate" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
            )}
          </div>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
          <h1 className="text-lg font-bold text-ink mb-1">Student Test Login</h1>
          <p className="text-xs text-ink-soft mb-5">Enter your Student ID and Date of Birth to proceed.</p>

          {error && <div className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>}

          {!candidate ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="label">Student ID</label>
                <input
                  className="input font-mono uppercase"
                  required
                  value={studentIdCode}
                  onChange={(e) => setStudentIdCode(e.target.value.toUpperCase())}
                  placeholder="AP27000001"
                />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <button type="submit" disabled={verifying} className="btn-primary w-full">
                {verifying ? "Verifying..." : "Verify Identity"}
              </button>
            </form>
          ) : (
            <div>
              <div className="bg-green-50 border border-success/30 rounded-xl p-4 mb-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-success/40 flex-shrink-0 bg-white">
                  {candidate.photoUrl ? (
                    <img src={candidate.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-ink">{candidate.name}</div>
                  <div className="text-xs text-success">✓ Identity verified</div>
                </div>
              </div>
              <p className="text-xs text-ink-soft mb-4">
                Is this you? If the name/photo above is incorrect, contact your invigilator immediately — do not proceed.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCandidate(null);
                    setError("");
                  }}
                  className="btn-secondary flex-1"
                >
                  Not Me
                </button>
                <button onClick={handleConfirm} disabled={confirming} className="btn-primary flex-1">
                  {confirming ? "Starting..." : "Confirm & Proceed →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
