import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

function stripFormula(text: string): string {
  // Keep exports readable — strip $...$ LaTeX delimiters, leave the raw text.
  return (text || "").replace(/\$\$?/g, "");
}

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const format = req.nextUrl.searchParams.get("format") || "csv";
  const subjectParam = req.nextUrl.searchParams.get("subject");
  const chapter = req.nextUrl.searchParams.get("chapter");

  // Rule 3: a Teacher only ever exports their own subject.
  const subject = session.role === "TEACHER" ? session.subject || "__none__" : subjectParam;

  const questions = await prisma.question.findMany({
    where: {
      subject: subject || undefined,
      chapter: chapter || undefined,
    },
    include: { translations: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = questions.map((q) => {
    const en = q.translations.find((t) => t.language === "en") || q.translations[0];
    const hi = q.translations.find((t) => t.language === "hi");
    const options = (en?.options as any[]) || [];
    const correctIds = (en?.correctOptionIds as string[]) || [];
    const correctText = options
      .filter((o) => correctIds.includes(o.id))
      .map((o) => `${o.id}. ${stripFormula(o.text)}`)
      .join(" | ");

    return {
      "Question ID": q.questionCode || "",
      "Question Text": stripFormula(en?.statement || ""),
      "Option A": stripFormula(options.find((o) => o.id === "A")?.text || ""),
      "Option B": stripFormula(options.find((o) => o.id === "B")?.text || ""),
      "Option C": stripFormula(options.find((o) => o.id === "C")?.text || ""),
      "Option D": stripFormula(options.find((o) => o.id === "D")?.text || ""),
      Section: q.subject,
      Chapter: q.chapter || "",
      Topic: q.topic || "",
      "Sub Topic": q.subTopic || "",
      Difficulty: q.difficulty,
      Type: q.type,
      "Correct Answer": correctText || (correctIds[0] ?? ""),
      "Solution (English)": stripFormula((en as any)?.solution || ""),
      "Solution (Hindi)": stripFormula((hi as any)?.solution || ""),
      Category: q.category || "",
      "PYQ Source": q.pyqSource || "",
    };
  });

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Question Bank");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="question-bank-${subject || "all"}.xlsx"`,
      },
    });
  }

  // CSV
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="question-bank-${subject || "all"}.csv"`,
    },
  });
}
