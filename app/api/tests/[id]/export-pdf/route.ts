import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { buildCombinedPdfHtml, buildTestCover, buildPdfFooterTemplate, buildPdfHeaderTemplate } from "@/lib/examPdfHtml";
import { getBrowser } from "@/lib/pdfBrowser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // One combined PDF per the export overhaul: Cover -> Questions -> [Answer
  // Key -> Solutions] if withSolutions=true. Replaces the old separate
  // Question-PDF / Solution-PDF pair.
  const withSolutions = req.nextUrl.searchParams.get("withSolutions") === "true";
  const lang = (req.nextUrl.searchParams.get("lang") === "hi" ? "hi" : "en") as "hi" | "en";

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { translations: true } } },
          },
        },
      },
    },
  });
  if (!test) return NextResponse.json({ message: "Test not found" }, { status: 404 });

  const sections = test.sections.map((sec) => ({
    name: sec.name,
    questions: sec.questions.map((sq) => ({
      topic: sq.question.topic,
      difficulty: sq.question.difficulty,
      imageUrl: sq.question.imageUrl,
      translations: sq.question.translations.map((t) => ({
        language: t.language,
        statement: t.statement,
        options: t.options as any,
        correctOptionIds: t.correctOptionIds as any,
        solution: t.solution,
      })),
    })),
  }));

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const coverHtml = buildTestCover({
    testName: test.name,
    testCode: test.code,
    durationMin: test.durationMin,
    correctMarks: test.correctMarks,
    incorrectMarks: test.incorrectMarks,
    totalQuestions,
    languageMode: test.languageMode,
  });

  const html = buildCombinedPdfHtml({
    coverHtml,
    sections,
    lang,
    languageMode: test.languageMode,
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

    const langSuffix = test.languageMode === "BOTH" ? "hi-en" : lang;
    const suffix = withSolutions ? "with-solutions" : "questions-only";
    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${test.code}-${suffix}-${langSuffix}.pdf"`,
      },
    });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ message: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}
