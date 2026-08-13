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

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  async function patchDpp(data: any) {
    setBusy(true);

    try {
      const res = await fetch(`/api/dpps/${dppId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(d.message || "Action failed");
        return;
      }

      setOpen(false);
      onActionComplete?.();
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    // Existing behaviour retained for now.
    // This can be converted to the same custom modal later.
    const name = window.prompt("New DPP name:", dppName);

    if (!name || name === dppName) return;

    await patchDpp({ name });
  }

  async function handleFaculty() {
    // Existing behaviour retained for now.
    // This can be converted to the same custom modal later.
    const facultyName = window.prompt(
      'Faculty display name (e.g. "By Firoz Sir"):'
    );

    if (facultyName === null) return;

    await patchDpp({ facultyName });
  }

  async function handleRevertToDraft() {
    const confirmed = window.confirm(
      `Revert "${dppName}" to Draft?\n\nStudents won't see it until it is published again.`
    );

    if (!confirmed) return;

    await patchDpp({
      status: "DRAFT",
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
    if (deleteCode.trim() !== dppCode) {
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`/api/dpps/${dppId}`, {
        method: "DELETE",
      });

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(d.message || "Delete failed");
        return;
      }

      setDeleteModalOpen(false);
      setDeleteCode("");

      onActionComplete?.();
    } catch (error) {
      console.error("[DELETE DPP]", error);
      alert("Unable to delete DPP. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const deleteConfirmed = deleteCode.trim() === dppCode;

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          className="w-8 h-8 rounded-full hover:bg-slate-100 active:scale-90 transition-all duration-150 flex items-center justify-center text-slate-500"
          aria-label="DPP actions"
        >
          <span className="material-symbols-outlined text-lg">
            more_vert
          </span>
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border z-20 py-1 text-sm">
            <Link
              href={`/admin/dpps/${dppId}/edit`}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150 flex items-center gap-2"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-base">
                edit
              </span>
              Edit DPP
            </Link>

            <div className="h-px bg-slate-100 my-1" />

            <button
              type="button"
              onClick={handleRename}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150"
            >
              Quick Rename
            </button>

            <button
              type="button"
              onClick={handleFaculty}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150"
            >
              Quick Edit Faculty
            </button>

            {status === "PUBLISHED" && (
              <button
                type="button"
                onClick={handleRevertToDraft}
                disabled={busy}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors duration-150"
              >
                Revert to Draft
              </button>
            )}

            <div className="h-px bg-slate-100 my-1" />

            <button
              type="button"
              onClick={openDeleteModal}
              disabled={busy}
              className="w-full text-left px-4 py-2 hover:bg-red-50 text-danger transition-colors duration-150"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) {
              closeDeleteModal();
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dpp-title"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">
                    delete_forever
                  </span>
                </div>

                <div>
                  <h2
                    id="delete-dpp-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    Permanently Delete DPP
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  {dppName}
                </p>

                <p className="text-xs text-red-700 mt-1">
                  DPP Code:{" "}
                  <span className="font-mono font-semibold">
                    {dppCode}
                  </span>
                </p>

                {hasAttempts && (
                  <p className="text-xs text-red-700 mt-3">
                    ⚠️ Students have attempted this DPP. Their attempts,
                    answers and violation records will also be permanently
                    deleted.
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="delete-dpp-code"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  Type{" "}
                  <span className="font-mono font-semibold">
                    {dppCode}
                  </span>{" "}
                  to confirm
                </label>

                <input
                  id="delete-dpp-code"
                  type="text"
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value)}
                  placeholder={dppCode}
                  autoFocus
                  disabled={busy}
                  autoComplete="off"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!deleteConfirmed || busy}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 hover:shadow-md active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {busy ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}