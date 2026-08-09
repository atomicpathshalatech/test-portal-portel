import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isManagerTier } from "@/lib/permissions";
import { integrityBand } from "@/lib/integrity";

export default async function SecurityCenterPage() {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) redirect("/admin");

  const attempts = await prisma.attempt.findMany({
    where: { violations: { some: {} } },
    include: {
      student: { select: { name: true, email: true } },
      test: { select: { name: true } },
      violations: true,
    },
    orderBy: { integrityScore: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Security Center</h1>
      <p className="text-slate-500 text-sm mb-6">
        Attempts with at least one integrity violation, most suspicious first.
      </p>

      {attempts.length === 0 ? (
        <div className="card text-center text-slate-500">No violations recorded yet. All clean ✅</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Test</th>
                <th className="py-2 pr-4">Violations</th>
                <th className="py-2 pr-4">Integrity Score</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const band = integrityBand(a.integrityScore);
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-800">{a.student.name}</div>
                      <div className="text-xs text-slate-400">{a.student.email}</div>
                    </td>
                    <td className="py-2 pr-4">{a.test?.name || "—"}</td>
                    <td className="py-2 pr-4">{a.violations.length}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${band.color}`}>
                        {a.integrityScore}% · {band.label}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{a.status.replace("_", " ")}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/admin/security/${a.id}`} className="text-brand text-sm font-medium">
                        View Timeline →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
