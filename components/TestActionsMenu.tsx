"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TestActionsMenu({
  testId,
  testName,
  testCode,
  archived,
  isDraft,
  canManage,
}: {
  testId: string;
  testName: string;
  testCode: string;
  archived: boolean;
  isDraft: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
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

  async function patchTest(data: any) {
    setBusy(true);
    const res = await fetch(`/api/tests/${testId}`, {
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
    router.refresh();
  }

  async function handleRename() {
    const name = prompt("New test name:", testName);
    if (!name || name === testName) return;
    await patchTest({ name });
  }

  async function handleReschedule() {
    const input = prompt("New start date & time (YYYY-MM-DD HH:MM):");
    if (!input) return;
    const parsed = new Date(input.replace(" ", "T"));
    if (isNaN(parsed.getTime())) {
      alert("Couldn't parse that date/time — use format YYYY-MM-DD HH:MM");
      return;
    }
    await patchTest({ openTime: parsed.toISOString() });
  }

  async function handleDuration() {
    const input = prompt("New duration in minutes:");
    if (!input) return;
    const minutes = Number(input);
    if (isNaN(minutes) || minutes <= 0) {
      alert("Enter a valid number of minutes");
      return;
    }
    await patchTest({ durationMin: minutes });
  }

  async function handleDuplicate() {
    setBusy(true);
    const res = await fetch(`/api/tests/${testId}/duplicate`, { method: "POST" });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Duplicate failed");
      return;
    }
    router.refresh();
  }

  async function handleArchiveToggle() {
    await patchTest({ archived: !archived });
  }

  async function handleDelete() {
    if (isDraft) {
      if (!confirm(`Permanently delete "${testName}" (Code: ${testCode})? This cannot be undone.`)) return;
      setBusy(true);
      const res = await fetch(`/api/tests/${testId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setBusy(false);
      setOpen(false);
      if (!res.ok) {
        const d = await res.json();
        alert(d.message || "Delete failed");
        return;
      }
      router.refresh();
      return;
    }

    const typed = prompt(
      `⚠️ This test is not a draft — it may have student results, ranks and attempts attached, and ALL of that will be permanently deleted too.\n\nType the exact test Code to confirm: "${testCode}"`
    );
    if (typed === null) return;
    setBusy(true);
    const res = await fetch(`/api/tests/${testId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmCode: typed }),
    });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.message || "Delete failed");
      return;
    }
    router.refresh();
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
        <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border z-20 py-1 text-sm">
          <button onClick={handleRename} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Rename Test
          </button>
          <button onClick={handleReschedule} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Reschedule Test
          </button>
          <button onClick={handleDuration} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Change Duration
          </button>
          <button onClick={handleDuplicate} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
            Duplicate Test
          </button>
          {canManage && (
            <button onClick={handleArchiveToggle} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700">
              {archived ? "Unarchive" : "Archive"}
            </button>
          )}
          <Link
            href={`/admin/audit-logs?entityId=${testId}`}
            className="block px-4 py-2 hover:bg-slate-50 text-slate-700"
            onClick={() => setOpen(false)}
          >
            Audit Log
          </Link>
          {canManage && (
            <>
              <div className="h-px bg-slate-100 my-1" />
              <button onClick={handleDelete} disabled={busy} className="w-full text-left px-4 py-2 hover:bg-red-50 text-danger">
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
