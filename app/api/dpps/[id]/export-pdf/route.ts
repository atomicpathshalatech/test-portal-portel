import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { buildCombinedPdfHtml, buildDppCoverPageHtml, buildPdfFooterTemplate, buildPdfHeaderTemplate } from "@/lib/examPdfHtml";
import { getDppLevel } from "@/lib/dppLevels";
import { getBrowser } from "@/lib/pdfBrowser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const withSolutions = req.nextUrl.searchParams.get("withSolutions") === "true";
  const lang = (req.nextUrl.searchParams.get("lang") === "hi" ? "hi" : "en") as "hi" | "en";

  // Solutions export is admin-only (answer key shouldn't leak to students
  // before they've attempted); the plain question-paper export is fine for
  // students revising offline.
  if (withSolutions && !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const dpp = await prisma.dpp.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { translations: true } } },
      },
    },
  });
  if (!dpp) return NextResponse.json({ message: "DPP not found" }, { status: 404 });
  if (session.role === "STUDENT" && dpp.status !== "PUBLISHED") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const sections = [
    {
      name: dpp.subject,
      questions: dpp.questions.map((dq) => ({
        topic: dq.question.topic,
        difficulty: dq.question.difficulty,
        imageUrl: dq.question.imageUrl,
        translations: dq.question.translations.map((t) => ({
          language: t.language,
          statement: t.statement,
          options: t.options as any,
          correctOptionIds: t.correctOptionIds as any,
          solution: t.solution,
        })),
      })),
    },
  ];

  const dppLevel = getDppLevel(dpp.level);
  const coverHtml = buildDppCoverPageHtml({
    dppName: dpp.name,
    dppCode: dpp.code,
    subject: dpp.subject,
    facultyName: dpp.facultyName,
    levelNumber: dpp.level,
    levelName: dppLevel?.name,
  });

  const html = buildCombinedPdfHtml({
    coverHtml,
    sections,
    lang,
    languageMode: dpp.languageMode,
    withSolutions,
  });

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "48px", left: "16px", right: "16px" },
      displayHeaderFooter: true,
      headerTemplate: buildPdfHeaderTemplate(),
      footerTemplate: buildPdfFooterTemplate(),
    });
    await browser.close();

    const langSuffix = dpp.languageMode === "BOTH" ? "hi-en" : lang;
    const suffix = withSolutions ? "with-solutions" : "questions-only";
    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${dpp.code}-${suffix}-${langSuffix}.pdf"`,
      },
    });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ message: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}
