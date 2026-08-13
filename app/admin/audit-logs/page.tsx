"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type LogRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; role: string };
};

const ACTION_LABEL: Record<string, string> = {
  CREATE_TEST: "Created a test",
  CREATE_QUESTION: "Added a question",
  CREATE_USER: "Created a user account",
  CHANGE_LOGIN_POLICY: "Changed login policy",
  EDIT_TEST: "Edited test details",
  ARCHIVE_TEST: "Archived the test",
  UNARCHIVE_TEST: "Unarchived the test",
  DELETE_TEST: "Deleted the test",
  DUPLICATE_TEST: "Duplicated the test",
  EDIT_QUESTION: "Edited a question",
  CORRECT_QUESTION: "Corrected a question",
  RECALCULATE_RESULTS: "Recalculated results",
  CREATE_TEST_SERIES: "Created a test series",
  EDIT_TEST_SERIES: "Edited a test series",
  RESTORE_QUESTION_VERSION: "Restored a question version",
  SEND_NOTIFICATION: "Sent a notification",
};

function labelFor(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith("TEST_STATUS_")) return `Changed test status → ${action.replace("TEST_STATUS_", "")}`;
  if (action.startsWith("QUESTION_")) return `Question review → ${action.replace("QUESTION_", "")}`;
  if (action.startsWith("REPORT_")) return `Report → ${action.replace("REPORT_", "")}`;
  return action;
}

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const entityId = searchParams.get("entityId");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = entityId ? `/api/audit-logs?entityId=${entityId}` : "/api/audit-logs";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d);
        setLoading(false);
      });
  }, [entityId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Audit Logs</h1>
      <p className="text-slate-500 text-sm mb-6">
        {entityId ? (
          <>
            Showing history for one item only. <Link href="/admin/audit-logs" className="text-brand underline hover:opacity-70 transition-opacity duration-150">View all logs →</Link>
          </>
        ) : (
          "Every significant action across the system — who did what, and when."
        )}
      </p>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-6">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-slate-800">{l.user.name}</div>
                    <div className="text-xs text-slate-400">{l.user.role.replace("_", " ")}</div>
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{labelFor(l.action)}</td>
                  <td className="py-2 pr-4 text-slate-500">{l.details || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
