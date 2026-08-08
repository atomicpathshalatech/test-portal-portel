import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { buildReportRows, rowsToCsv, rowsToXlsxBuffer } from "@/lib/reportExport";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const test = await prisma.test.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ message: "Test not found" }, { status: 404 });

  const attempts = await prisma.attempt.findMany({
    where: { testId: params.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    include: {
      student: {
        select: { name: true, email: true, state: true, city: true, institute: true, batch: true },
      },
      answers: { include: { question: { select: { subject: true, difficulty: true } } } },
    },
  });

  const { rows } = buildReportRows(attempts as any);

  if (rows.length === 0) {
    return NextResponse.json({ message: "No submitted attempts yet for this test" }, { status: 404 });
  }

  const filenameBase = `${test.code}-report`;

  if (format === "csv") {
    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const buffer = rowsToXlsxBuffer(rows, test.code);
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}
