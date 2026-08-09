"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function DppActionsMenu({
  dppId,
  dppName,
  dppCode,
  status,
  hasAttempts,
  onActionComplete,
}: {
  dppId: string;
  dppName: string;
  dppCode: string;
  status: string;
  hasAttempts: boolean;
  onActionComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function patchDpp(data: any) {
    setBusy(true);
    const res = await fetch(`/api/dpps/${dppId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Action failed");
      return;
    }
    onActionComplete?.();
  }

  async function handleRename() {
    const name = prompt("New DPP name:", dppName);
    if (!name || name === dppName) return;
    await patchDpp({ name });
  }

  async function handleFaculty() {
    const facultyName = prompt("Faculty display name (e.g. \"By Firoz Sir\"):");
    if (facultyName === null) return;
    await patchDpp({ facultyName });
  }

  async function handleRevertToDraft() {
    if (!confirm(`Revert "${dppName}" to Draft? Students won't see it until re-published.`)) return;
    await patchDpp({ status: "DRAFT" });
  }

  async function handleDelete() {
    if (hasAttempts) {
      alert("Cannot delete — students have already attempted this DPP.");
      return;
    }
    const typed = prompt(`Type the DPP code to confirm permanent deletion: "${dppCode}"`);
    if (typed !== dppCode) {
      if (typed !== null) alert("Code didn't match — deletion cancelled.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/dpps/${dppId}`, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Delete failed");
      return;
    }
    onActionComplete?.();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border z-20 py-1 text-sm">
          <Link
            href={`/admin/dpps/${dppId}/edit`}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-base">edit</span> Edit DPP
          </Link>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={handleRename} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Quick Rename
          </button>
          <button onClick={handleFaculty} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Quick Edit Faculty
          </button>
          {status === "PUBLISHED" && (
            <button onClick={handleRevertToDraft} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
              Revert to Draft
            </button>
          )}
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={handleDelete} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-red-50 text-danger">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
