"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteQuestionButton({
  questionId,
}: {
  questionId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this question permanently?\n\nThis action cannot be undone."
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
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 text-xs underline ml-2 hover:opacity-70 transition-opacity duration-150 disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}