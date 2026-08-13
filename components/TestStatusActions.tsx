"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-warning",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-purple-100 text-purple-700",
  PUBLISHED: "bg-green-100 text-success",
};

export default function TestStatusActions({
  testId,
  status,
  canSubmit,
  canPublish,
  questionsReady,
}: {
  testId: string;
  status: string;
  canSubmit: boolean;
  canPublish: boolean;
  questionsReady: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function transition(next: string) {
    setLoading(true);
    const res = await fetch(`/api/tests/${testId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.message || "Failed to update status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}>
        {status.replace("_", " ")}
      </span>

      {status === "DRAFT" && canSubmit && (
        <button
          onClick={() => transition("UNDER_REVIEW")}
          disabled={loading || !questionsReady}
          title={!questionsReady ? "All sections must reach their target question count first" : ""}
          className="text-xs text-brand underline hover:opacity-70 transition-opacity duration-150 disabled:opacity-40 disabled:no-underline"
        >
          Submit for Review
        </button>
      )}

      {(status === "UNDER_REVIEW" || status === "APPROVED") && (
        <Link href={`/admin/tests/${testId}/review-mode`} className="text-xs text-purple-600 underline hover:opacity-70 transition-opacity duration-150">
          Review Test
        </Link>
      )}

      {status === "UNDER_REVIEW" && canPublish && (
        <button onClick={() => transition("APPROVED")} disabled={loading} className="text-xs text-purple-600 underline hover:opacity-70 transition-opacity duration-150">
          Approve Test
        </button>
      )}

      {status === "APPROVED" && canPublish && (
        <button onClick={() => transition("PUBLISHED")} disabled={loading} className="text-xs text-success underline hover:opacity-70 transition-opacity duration-150">
          Publish
        </button>
      )}

      {status !== "DRAFT" && status !== "PUBLISHED" && canPublish && (
        <button onClick={() => transition("DRAFT")} disabled={loading} className="text-xs text-slate-400 underline hover:opacity-70 transition-opacity duration-150">
          Revert to Draft
        </button>
      )}
    </div>
  );
}
