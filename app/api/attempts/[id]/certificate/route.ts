import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { buildCertificateHtml } from "@/lib/certificateHtml";
import { getBrowser } from "@/lib/pdfBrowser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.attempt.findUnique({
    where: { id: params.id },
    include: { student: { select: { name: true } }, test: { select: { name: true, id: true } } },
  });
  if (!attempt) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!attempt.test) {
    return NextResponse.json({ message: "Certificates are only available for Test attempts, not DPP practice." }, { status: 400 });
  }
  const test = attempt.test;

  const isOwner = attempt.studentId === session.id;
  if (!isOwner && !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (attempt.status !== "SUBMITTED" && attempt.status !== "AUTO_SUBMITTED") {
    return NextResponse.json({ message: "Certificate is only available after the test is submitted" }, { status: 400 });
  }

  const totalStudents = await prisma.attempt.count({
    where: { testId: attempt.testId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
  });

  const html = buildCertificateHtml({
    studentName: attempt.student.name,
    testName: test.name,
    score: attempt.score,
    rank: attempt.rank,
    totalStudents,
    date: attempt.submittedAt || new Date(),
  });

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", landscape: true, printBackground: true });
    await browser.close();

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${test.name.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ message: `Certificate generation failed: ${err.message}` }, { status: 500 });
  }
}
