"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PhotoCropUpload from "@/components/PhotoCropUpload";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  subject: string | null;
  mobile: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  photoUrl: string | null;
  state: string | null;
  city: string | null;
  institute: string | null;
  batch: string | null;
  course: string | null;
  studentIdCode: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SUB_ADMIN: "Sub Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [newPhotoBlob, setNewPhotoBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState("");

  function load() {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        setForm(d);
        setLoading(false);
      });
  }
  useEffect(load, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    let photoUrl = form.photoUrl;
    if (newPhotoBlob) {
      const fd = new FormData();
      fd.append("photo", newPhotoBlob, "photo.jpg");
      const uploadRes = await fetch("/api/profile/photo", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (uploadRes.ok) photoUrl = uploadData.url;
    }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        mobile: form.mobile,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        state: form.state,
        city: form.city,
        institute: form.institute,
        batch: form.batch,
        course: form.course,
        photoUrl,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Failed to save changes.");
      return;
    }
    setMessage("✓ Profile updated.");
    setEditing(false);
    setNewPhotoBlob(null);
    load();
  }

  if (loading || !profile) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  const isStudent = profile.role === "STUDENT";
  const isAdminTier = !isStudent;
  const backLink = isAdminTier ? "/admin" : "/student";

  return (
    <div className={isAdminTier ? "max-w-2xl" : "max-w-2xl mx-auto"}>
      <Link href={backLink} className="text-sm text-brand mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
              ✏️ Edit Profile
            </button>
          )}
        </div>

        {message && <div className="text-sm text-success mb-4">{message}</div>}

        <div className="flex items-start gap-6 mb-6">
          <div className="flex-shrink-0">
            {editing ? (
              <PhotoCropUpload onCropped={setNewPhotoBlob} />
            ) : profile.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-24 h-24 rounded-xl object-cover border" />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
                <span className="material-symbols-outlined text-4xl">person</span>
              </div>
            )}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{profile.name}</div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-medium">
              {ROLE_LABEL[profile.role]}
            </span>
            {profile.studentIdCode && (
              <div className="text-sm font-mono text-slate-600 mt-1">Student ID: {profile.studentIdCode}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name" editing={editing} value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} display={profile.name} />
          <Field label="Email" editing={false} value={profile.email} onChange={() => {}} display={profile.email} note="Cannot be changed" />

          {isStudent && (
            <>
              <Field label="Mobile" editing={editing} value={form.mobile || ""} onChange={(v) => setForm({ ...form, mobile: v })} display={profile.mobile || "—"} />
              <Field
                label="Date of Birth"
                editing={editing}
                type="date"
                value={form.dateOfBirth ? String(form.dateOfBirth).slice(0, 10) : ""}
                onChange={(v) => setForm({ ...form, dateOfBirth: v })}
                display={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : "—"}
              />
              {editing ? (
                <div>
                  <label className="label text-xs">Gender</label>
                  <select className="input" value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              ) : (
                <Field label="Gender" editing={false} value="" onChange={() => {}} display={profile.gender || "—"} />
              )}
              <Field label="Course" editing={editing} value={form.course || ""} onChange={(v) => setForm({ ...form, course: v })} display={profile.course || "—"} />
              <Field label="State" editing={editing} value={form.state || ""} onChange={(v) => setForm({ ...form, state: v })} display={profile.state || "—"} />
              <Field label="City" editing={editing} value={form.city || ""} onChange={(v) => setForm({ ...form, city: v })} display={profile.city || "—"} />
              <Field label="Batch" editing={editing} value={form.batch || ""} onChange={(v) => setForm({ ...form, batch: v })} display={profile.batch || "—"} />
              <Field label="Institute" editing={editing} value={form.institute || ""} onChange={(v) => setForm({ ...form, institute: v })} display={profile.institute || "—"} />
            </>
          )}

          {profile.role === "TEACHER" && (
            <Field label="Assigned Subject" editing={false} value="" onChange={() => {}} display={profile.subject || "—"} note="Set by Admin" />
          )}

          <Field label="Member Since" editing={false} value="" onChange={() => {}} display={new Date(profile.createdAt).toLocaleDateString()} />
        </div>

        {editing && (
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => {
                setEditing(false);
                setForm(profile);
                setNewPhotoBlob(null);
              }}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <Link href="/change-password" className="text-sm text-brand underline">
            🔒 Change Password
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, editing, value, onChange, display, type = "text", note,
}: {
  label: string; editing: boolean; value: string; onChange: (v: string) => void; display: string; type?: string; note?: string;
}) {
  if (editing && !note) {
    return (
      <div>
        <label className="label text-xs">{label}</label>
        <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{display}</div>
      {note && <div className="text-[10px] text-slate-400">{note}</div>}
    </div>
  );
}
