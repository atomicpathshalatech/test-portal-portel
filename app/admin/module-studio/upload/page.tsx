"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_SIZE_BYTES = 100 * 1024 * 1024;

type UploadStatus = "idle" | "uploading" | "success" | "error";

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UploadModulePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    router.prefetch("/admin/module-studio");
  }, [router]);

  const canSubmit = useMemo(
    () => Boolean(file && title.trim() && rightsConfirmed && status !== "uploading"),
    [file, title, rightsConfirmed, status]
  );

  function pickFile(nextFile: File | null) {
    if (!nextFile) return;

    if (!isPdfFile(nextFile)) {
      setStatus("error");
      setError("Please select a PDF file.");
      return;
    }

    if (nextFile.size > MAX_SIZE_BYTES) {
      setStatus("error");
      setError("PDF must be under 100MB.");
      return;
    }

    setStatus("idle");
    setError("");
    setFile(nextFile);
    if (!title.trim()) setTitle(nextFile.name.replace(/\.pdf$/i, ""));
  }

  function removeFile() {
    setFile(null);
    setStatus("idle");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return;
    setDragActive(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus("error");
      setError("Please select a PDF to upload.");
      return;
    }
    if (!title.trim()) {
      setStatus("error");
      setError("Module title is required.");
      return;
    }
    if (!rightsConfirmed) {
      setStatus("error");
      setError("Please confirm you have rights to edit and reproduce this material.");
      return;
    }

    setStatus("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("subject", subject.trim());
    formData.append("class", klass.trim());
    formData.append("batch", batch.trim());
    formData.append("chapter", chapter.trim());
    formData.append("facultyName", facultyName.trim());
    formData.append("academicYear", academicYear.trim());
    formData.append("rightsConfirmed", String(rightsConfirmed));

    try {
      const res = await fetch("/api/module-studio/upload", {
        method: "POST",
        body: formData,
      });

      const responseText = await res.text();
      let data: any = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error("[MODULE UPLOAD] Invalid JSON response:", responseText);
          setStatus("error");
          setError(`Server returned an invalid response (HTTP ${res.status}).`);
          return;
        }
      }

      if (!res.ok) {
        console.error("[MODULE UPLOAD] API error:", { status: res.status, data });
        setStatus("error");
        setError(data?.message || data?.error || `Upload failed (HTTP ${res.status})`);
        return;
      }

      if (!data?.module?.id) {
        console.error("[MODULE UPLOAD] Missing module in response:", data);
        setStatus("error");
        setError("Upload completed but the server returned no module ID.");
        return;
      }

      setStatus("success");
      router.push(`/admin/module-studio/${data.module.id}`);
    } catch (err) {
      console.error("[MODULE UPLOAD] Request failed:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload request failed.");
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            <span className="material-symbols-outlined text-base">auto_stories</span>
            Module Studio
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Upload Module</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Add the PDF once, confirm rights, and open it directly in the editor.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 sm:min-w-[360px]">
          {[
            ["upload_file", "PDF"],
            ["fact_check", "Metadata"],
            ["edit_document", "Editor"],
          ].map(([icon, label], index) => (
            <div key={label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span
                className={`material-symbols-outlined text-lg ${
                  (index === 0 && file) || (index === 1 && title.trim()) || status === "success"
                    ? "text-brand"
                    : "text-slate-400"
                }`}
              >
                {icon}
              </span>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickFile(e.dataTransfer.files?.[0] || null);
            }}
            className={`group flex min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-5 py-8 text-center transition-all duration-150 ${
              dragActive
                ? "border-brand bg-brand-light"
                : file
                  ? "border-emerald-300 bg-emerald-50/60"
                  : "border-slate-300 bg-slate-50 hover:border-brand/70 hover:bg-brand-light/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />

            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-lg ${
                file ? "bg-emerald-100 text-emerald-700" : "bg-white text-brand shadow-sm"
              }`}
            >
              <span className="material-symbols-outlined text-3xl">{file ? "description" : "upload_file"}</span>
            </div>

            {file ? (
              <div className="w-full max-w-lg">
                <p className="truncate text-base font-semibold text-slate-950">{file.name}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-white px-3 py-2 text-left">
                    <p className="text-xs text-slate-400">Size</p>
                    <p className="font-medium text-slate-700">{formatSize(file.size)}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 text-left">
                    <p className="text-xs text-slate-400">Type</p>
                    <p className="font-medium text-slate-700">PDF</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={status === "uploading"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">swap_horiz</span>
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={status === "uploading"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-base font-semibold text-slate-950">Drop PDF here</p>
                <p className="mt-1 text-sm text-slate-500">Maximum file size: 100MB</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-lg">folder_open</span>
                  Choose PDF
                </button>
              </div>
            )}
          </div>

          {status === "uploading" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-amber-800">Uploading and reading PDF</span>
                <span className="text-amber-700">Please wait</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-500" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-lg">error</span>
              <p>{error}</p>
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Module Details</h2>
            <p className="mt-1 text-sm text-slate-500">These fields make the module easier to find later.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Module Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={status === "uploading"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={status === "uploading"} />
              </div>
              <div>
                <label className="label">Class</label>
                <input className="input" value={klass} onChange={(e) => setKlass(e.target.value)} disabled={status === "uploading"} />
              </div>
              <div>
                <label className="label">Batch</label>
                <input className="input" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={status === "uploading"} />
              </div>
              <div>
                <label className="label">Academic Year</label>
                <input
                  className="input"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  disabled={status === "uploading"}
                />
              </div>
            </div>

            <div>
              <label className="label">Chapter</label>
              <input className="input" value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={status === "uploading"} />
            </div>

            <div>
              <label className="label">Faculty</label>
              <input
                className="input"
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                disabled={status === "uploading"}
              />
            </div>
          </div>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
              rightsConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              disabled={status === "uploading"}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>
              <span className="block font-semibold">Rights confirmed</span>
              <span className="block text-xs opacity-80">I have permission to edit, reproduce, and distribute this material.</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-lg ${status === "uploading" ? "animate-spin" : ""}`}>
              {status === "uploading" ? "progress_activity" : status === "success" ? "check_circle" : "cloud_upload"}
            </span>
            {status === "uploading" ? "Uploading..." : status === "success" ? "Opening Editor..." : "Upload Module"}
          </button>
        </section>
      </form>
    </div>
  );
}
