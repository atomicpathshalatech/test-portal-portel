"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CheckInData = {
  targetCompleted: boolean;
  revisionCompleted: boolean;
  dppCompleted: boolean;
  testCompleted: boolean;
  hasDoubt: boolean;
  testsAttemptedToday: number;
  dppCompletedToday: number;
  pendingDoubts: number;
};

function ActionRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 active:scale-[0.99] ${
        checked ? "border-success bg-green-50" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors duration-150 ${
          checked ? "bg-success text-white" : "bg-slate-100 text-slate-400"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className={checked ? "text-success font-medium" : "text-ink"}>{label}</span>
    </button>
  );
}

export default function CheckInPage() {
  const router = useRouter();
  const [data, setData] = useState<CheckInData | null>(null);

  function load() {
    fetch("/api/checkin")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(key: keyof CheckInData) {
    if (!data) return;
    const next = !data[key];
    setData({ ...data, [key]: next });
    await fetch("/api/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
  }

  if (!data) return <div className="text-center text-ink-soft py-10">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">🌙 Day Check</h1>
        <p className="text-ink-soft mt-1">कितना पूरा हुआ आज का?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-brand">{data.testsAttemptedToday}</div>
          <div className="text-xs text-ink-soft mt-1">Tests Attempted Today</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-brand">{data.dppCompletedToday}</div>
          <div className="text-xs text-ink-soft mt-1">DPP Completed Today</div>
        </div>
      </div>

      <div className="space-y-2">
        <ActionRow label="✓ Target Completed" checked={data.targetCompleted} onToggle={() => toggle("targetCompleted")} />
        <ActionRow label="✓ Revision Completed" checked={data.revisionCompleted} onToggle={() => toggle("revisionCompleted")} />
        <ActionRow label="✓ DPP Completed" checked={data.dppCompleted} onToggle={() => toggle("dppCompleted")} />
        <ActionRow label="✓ Test Completed" checked={data.testCompleted} onToggle={() => toggle("testCompleted")} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-ink">Pending Doubts</div>
            <div className="text-xs text-ink-soft mt-0.5">
              {data.pendingDoubts > 0 ? `You have ${data.pendingDoubts} unresolved doubt(s)` : "No pending doubts — nice!"}
            </div>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/checkin", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hasDoubt: true }),
              });
              router.push("/student/doubts");
            }}
            className="btn-primary text-sm whitespace-nowrap"
          >
            ? Ask a Doubt
          </button>
        </div>
      </div>
    </div>
  );
}
