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

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);

    return () =>
      document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function patchTest(data: any) {
    setBusy(true);

    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const d = await res.json();
        alert(d.message || "Action failed");
        return;
      }

      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    const name = window.prompt(
      "New test name:",
      testName
    );

    if (!name || name === testName) return;

    await patchTest({ name });
  }

  async function handleReschedule() {
    const input = window.prompt(
      "New start date & time (YYYY-MM-DD HH:MM):"
    );

    if (!input) return;

    const parsed = new Date(
      input.replace(" ", "T")
    );

    if (isNaN(parsed.getTime())) {
      alert(
        "Couldn't parse that date/time — use format YYYY-MM-DD HH:MM"
      );
      return;
    }

    await patchTest({
      openTime: parsed.toISOString(),
    });
  }

  async function handleDuration() {
    const input = window.prompt(
      "New duration in minutes:"
    );

    if (!input) return;

    const minutes = Number(input);

    if (isNaN(minutes) || minutes <= 0) {
      alert("Enter a valid number of minutes");
      return;
    }

    await patchTest({
      durationMin: minutes,
    });
  }

  async function handleDuplicate() {
    setBusy(true);

    try {
      const res = await fetch(
        `/api/tests/${testId}/duplicate`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const d = await res.json();
        alert(d.message || "Duplicate failed");
        return;
      }

      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveToggle() {
    await patchTest({
      archived: !archived,
    });
  }

  function openDeleteModal() {
    setOpen(false);
    setDeleteCode("");
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (busy) return;

    setDeleteModalOpen(false);
    setDeleteCode("");
  }

  async function handleDelete() {
    // Draft deletion does not require test-code confirmation.
    if (isDraft) {
      setBusy(true);

      try {
        const res = await fetch(
          `/api/tests/${testId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!res.ok) {
          const d = await res.json();
          alert(d.message || "Delete failed");
          return;
        }

        setDeleteModalOpen(false);
        router.refresh();
      } finally {
        setBusy(false);
      }

      return;
    }

    // Published/non-draft test requires exact code.
    if (deleteCode.trim() !== testCode) {
      alert(
        `Incorrect test code.\n\nPlease type exactly:\n${testCode}`
      );
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(
        `/api/tests/${testId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmCode: deleteCode.trim(),
          }),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        alert(d.message || "Delete failed");
        return;
      }

      setDeleteModalOpen(false);
      setDeleteCode("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="relative"
        ref={ref}
      >
        <button
          type="button"
          onClick={() =>
            setOpen((o) => !o)
          }
          disabled={busy}
          className="w-8 h-8 rounded-full hover:bg-slate-100 active:scale-90 transition-all duration-150 flex items-center justify-center text-slate-500 disabled:opacity-50"
          aria-label="Test actions"
        >
          ⋮
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border z-20 py-1 text-sm">
            <button
              type="button"
              onClick={handleRename}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 disabled:opacity-50"
            >
              Rename Test
            </button>

            <button
              type="button"
              onClick={handleReschedule}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 disabled:opacity-50"
            >
              Reschedule Test
            </button>

            <button
              type="button"
              onClick={handleDuration}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 disabled:opacity-50"
            >
              Change Duration
            </button>

            <button
              type="button"
              onClick={handleDuplicate}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 disabled:opacity-50"
            >
              Duplicate Test
            </button>

            {canManage && (
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={busy}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 disabled:opacity-50"
              >
                {archived
                  ? "Unarchive"
                  : "Archive"}
              </button>
            )}

            <Link
              href={`/admin/audit-logs?entityId=${testId}`}
              className="block px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150"
              onClick={() => setOpen(false)}
            >
              Audit Log
            </Link>

            {canManage && (
              <>
                <div className="h-px bg-slate-100 my-1" />

                <button
                  type="button"
                  onClick={openDeleteModal}
                  disabled={busy}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-danger transition-colors duration-150 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* DELETE MODAL */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !busy
            ) {
              closeDeleteModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <span className="material-symbols-outlined">
                    delete_forever
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Permanently Delete Test
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                {isDraft ? (
                  <p className="text-sm text-red-800">
                    You are about to permanently delete:
                    <br />
                    <strong>{testName}</strong>
                    <br />
                    Code:{" "}
                    <strong>{testCode}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-red-800">
                    This test is not a draft. It may contain
                    <strong>
                      {" "}student results, ranks and attempts
                    </strong>
                    and all related data may be permanently
                    deleted.
                  </p>
                )}
              </div>

              {!isDraft && (
                <div className="mt-5">
                  <label
                    htmlFor={`delete-code-${testId}`}
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Type the exact test code to confirm
                  </label>

                  <div className="mb-2 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm font-semibold text-slate-800">
                    {testCode}
                  </div>

                  <input
                    id={`delete-code-${testId}`}
                    type="text"
                    value={deleteCode}
                    onChange={(e) =>
                      setDeleteCode(e.target.value)
                    }
                    placeholder="Enter test code"
                    autoFocus
                    disabled={busy}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
                  />
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    busy ||
                    (!isDraft &&
                      deleteCode.trim() !== testCode)
                  }
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 hover:shadow-md active:scale-[0.97] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                >
                  {busy
                    ? "Deleting..."
                    : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}