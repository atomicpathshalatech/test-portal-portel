import * as XLSX from "xlsx";

type AttemptAnswerRow = {
  isCorrect: boolean | null;
  selectedOptionIds: unknown;
  question: { subject: string; difficulty: string };
};

type AttemptRow = {
  score: number | null;
  rank: number | null;
  integrityScore: number;
  status: string;
  submittedAt: Date | null;
  student: {
    name: string;
    email: string;
    state: string | null;
    city: string | null;
    institute: string | null;
    batch: string | null;
  };
  answers: AttemptAnswerRow[];
};

export type ReportRow = Record<string, string | number>;

export function buildReportRows(attempts: AttemptRow[]): { rows: ReportRow[]; subjects: string[] } {
  const subjectSet = new Set<string>();
  for (const a of attempts) {
    for (const ans of a.answers) subjectSet.add(ans.question.subject);
  }
  const subjects = Array.from(subjectSet).sort();

  const sorted = [...attempts].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));

  const rows: ReportRow[] = sorted.map((a) => {
    const row: ReportRow = {
      Rank: a.rank ?? "",
      Name: a.student.name,
      Email: a.student.email,
      State: a.student.state || "",
      City: a.student.city || "",
      Institute: a.student.institute || "",
      Batch: a.student.batch || "",
      Score: a.score ?? "",
      "Integrity Score": a.integrityScore,
      Status: a.status,
      "Submitted At": a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "",
    };

    for (const subject of subjects) {
      let correct = 0;
      let incorrect = 0;
      let unattempted = 0;
      for (const ans of a.answers) {
        if (ans.question.subject !== subject) continue;
        const selected = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds : [];
        if (selected.length === 0) unattempted++;
        else if (ans.isCorrect) correct++;
        else incorrect++;
      }
      row[`${subject} Correct`] = correct;
      row[`${subject} Incorrect`] = incorrect;
      row[`${subject} Unattempted`] = unattempted;
    }

    return row;
  });

  return { rows, subjects };
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

export function rowsToXlsxBuffer(rows: ReportRow[], sheetName = "Report"): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
