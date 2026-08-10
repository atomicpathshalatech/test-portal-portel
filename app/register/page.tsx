"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PhotoCropUpload from "@/components/PhotoCropUpload";
import PasswordInput from "@/components/PasswordInput";

const POLICY_CHECKS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", dateOfBirth: "", gender: "", state: "", city: "", course: "",
    password: "", confirmPassword: "",
  });
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ studentIdCode: string; emailSent: boolean } | null>(null);

  const passwordChecks = POLICY_CHECKS.map((c) => ({ ...c, passed: c.test(form.password) }));
  const passwordValid = passwordChecks.every((c) => c.passed);
  const passwordsMatch = form.password && form.password === form.confirmPassword;

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
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (photoBlob) fd.append("photo", photoBlob, "photo.jpg");

    const res = await fetch("/api/auth/register", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Registration failed");
      return;
    }
    setSuccess({ studentIdCode: data.studentIdCode, emailSent: data.emailSent });
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-xl font-bold text-ink mb-2">Registration Successful!</h1>
          <p className="text-ink-soft text-sm mb-6">Welcome to Atomic Pathshala. Save your Student ID — you'll need it during exams.</p>
          <div className="bg-brand-light rounded-xl p-4 mb-6">
            <div className="text-xs text-brand font-semibold uppercase tracking-wider mb-1">Your Student ID</div>
            <div className="text-2xl font-bold text-brand font-mono">{success.studentIdCode}</div>
          </div>
          {success.emailSent ? (
            <p className="text-xs text-success mb-6">✓ A confirmation email has also been sent to you.</p>
          ) : (
            <p className="text-xs text-slate-400 mb-6">(Couldn't send confirmation email — please save your Student ID from here.)</p>
          )}
          <Link href="/" className="btn-primary w-full inline-block">Go to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 py-10">
      <div className="card max-w-lg w-full">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Atomic Pathshala" className="w-14 h-14 mx-auto rounded-xl mb-2" />
          <h1 className="text-xl font-bold text-ink">Create your Student Account</h1>
          <p className="text-ink-soft text-sm mt-1">Join Atomic Pathshala — start practicing today.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="label">Full Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mobile Number</label>
              <input className="input" required maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })} placeholder="10-digit number" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input" required value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">State</label>
              <input className="input" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Course</label>
            <input className="input" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="e.g. NEET 2027 Dropper Batch" />
          </div>

          <div>
            <label className="label">Passport Size Photograph (optional)</label>
            <PhotoCropUpload onCropped={setPhotoBlob} />
          </div>

          <div>
            <label className="label">Password</label>
            <PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <div className="grid grid-cols-2 gap-1 mt-2">
              {passwordChecks.map((c) => (
                <div key={c.label} className={`text-xs flex items-center gap-1 ${c.passed ? "text-success" : "text-slate-400"}`}>
                  <span>{c.passed ? "✓" : "○"}</span> {c.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Confirm Password</label>
            <PasswordInput required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
            {form.confirmPassword && (
              <div className={`text-xs mt-1 ${passwordsMatch ? "text-success" : "text-danger"}`}>
                {passwordsMatch ? "✓ Passwords match" : "✗ Passwords don't match"}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-xs text-ink-soft">
            Already have an account? <Link href="/" className="text-brand font-medium">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
