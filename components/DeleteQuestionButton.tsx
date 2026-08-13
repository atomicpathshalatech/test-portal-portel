"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteQuestionButton({
  questionId,
  archived = false,
}: {
  questionId: string;
  archived?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchiveToggle() {
    const confirmed = window.confirm(
      archived ? "Unarchive this question? It will become importable again." : "Archive this question?\n\nIt stays safe in any Test/DPP already using it, but can't be newly imported until unarchived."
    );
    if (!confirmed) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.message || "Could not update archive status.");
        return;
      }
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this question permanently?\n\nThis action cannot be undone. If this question might be used in any Test or DPP, consider Archiving it instead."
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        window.alert(data.message || "Question could not be deleted.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      window.alert("Something went wrong while deleting the question.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleArchiveToggle}
        disabled={archiving}
        className="text-slate-500 text-xs underline ml-2 hover:opacity-70 transition-opacity duration-150 disabled:opacity-50"
      >
        {archiving ? "..." : archived ? "Unarchive" : "Archive"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-600 text-xs underline ml-2 hover:opacity-70 transition-opacity duration-150 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
    </>
  );
}