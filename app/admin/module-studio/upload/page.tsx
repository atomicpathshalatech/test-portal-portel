"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadModulePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [klass, setKlass] = useState("");
  const [batch, setBatch] = useState("");
  const [chapter, setChapter] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }
    setError("");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF to upload.");
      return;
    }
    if (!rightsConfirmed) {
      setError("Please confirm you have rights to edit and reproduce this material.");
      return;
    }

    setStatus("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("class", klass);
    formData.append("batch", batch);
    formData.append("chapter", chapter);
    formData.append("facultyName", facultyName);
    formData.append("academicYear", academicYear);
    formData.append("rightsConfirmed", String(rightsConfirmed));

    try {
      const res = await fetch("/api/module-studio/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.message || "Upload failed");
        return;
      }
      router.push(`/admin/module-studio/${data.module.id}`);
    } catch {
      setStatus("error");
      setError("Upload failed — check your connection and try again.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Upload Module</h1>
      <p className="text-slate-500 text-sm mb-6">
        Upload an educational module PDF. Page structure is read immediately; content
        extraction, branding, and export happen in the editor after upload.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            pickFile(e.dataTransfer.files?.[0] || null);
          }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
            dragActive ? "border-indigo-400 bg-indigo-50" : "border-slate-300"
          }`}
        >
          {file ? (
            <div>
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-sm text-red-600 mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-slate-600 mb-2">Drag and drop a PDF here, or</p>
              <label className="btn-primary inline-block cursor-pointer">
                Choose File
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] || null)}
                />
              </label>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Module Title</label>
            <input
              className="input w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input className="input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <input className="input w-full" value={klass} onChange={(e) => setKlass(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
            <input className="input w-full" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
            <input className="input w-full" value={chapter} onChange={(e) => setChapter(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Faculty</label>
            <input
              className="input w-full"
              value={facultyName}
              onChange={(e) => setFacultyName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
            <input
              className="input w-full"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I confirm that I have the necessary rights or permission to edit, reproduce,
          and distribute this material.
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={status === "uploading"} className="btn-primary">
          {status === "uploading" ? "Uploading…" : "Upload Module"}
        </button>
      </form>
    </div>
  );
}
