import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { buildExamPdfHtml } from "@/lib/examPdfHtml";
import { getBrowser } from "@/lib/pdfBrowser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mode = (req.nextUrl.searchParams.get("mode") === "solution" ? "solution" : "question") as
    | "question"
    | "solution";
  // lang only matters for HINDI-only / ENGLISH-only tests; BOTH-mode tests
  // always render bilingual side-by-side regardless of this param.
  const lang = (req.nextUrl.searchParams.get("lang") === "hi" ? "hi" : "en") as "hi" | "en";
  const includeCoverPage = req.nextUrl.searchParams.get("cover") !== "false";

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
      })),
    })),
  }));

  const html = buildExamPdfHtml({
    testName: test.name,
    testCode: test.code,
    sections,
    lang,
    mode,
    correctMarks: test.correctMarks,
    incorrectMarks: test.incorrectMarks,
    durationMin: test.durationMin,
    languageMode: test.languageMode,
    includeCoverPage,
  });

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "16px", right: "16px" },
    });
    await browser.close();

    const langSuffix = test.languageMode === "BOTH" ? "hi-en" : lang;
    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${test.code}-${mode}-${langSuffix}.pdf"`,
      },
    });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ message: `PDF generation failed: ${err.message}` }, { status: 500 });
  }
}
