import { prisma } from "./prisma";

const SUBJECT_PREFIX: Record<string, string> = {
  Physics: "PH",
  Chemistry: "CH",
  Botany: "BO",
  Zoology: "ZO",
};

export async function generateQuestionCode(subject: string): Promise<string> {
  const prefix = SUBJECT_PREFIX[subject] || subject.slice(0, 2).toUpperCase();

  for (let i = 0; i < 8; i++) {
    const digits = String(Math.floor(10000 + Math.random() * 90000));
    const code = `${prefix}${digits}`;
    const exists = await prisma.question.findUnique({ where: { questionCode: code } });
    if (!exists) return code;
  }
  // Extremely unlikely fallback — timestamp-based, still unique
  return `${prefix}${Date.now().toString().slice(-5)}`;
}

// Full list shown in the PYQ source dropdown — kept in one place so it's
// easy to extend as new years/sessions become relevant.
export function buildPyqSourceOptions(): string[] {
  const options: string[] = [];
  for (let y = 2026; y >= 2017; y--) options.push(`NEET ${y}`);
  for (let y = 2016; y >= 1988; y--) options.push(`AIPMT ${y}`);
  for (let y = 2025; y >= 2020; y--) {
    options.push(`JEE Main ${y} April`);
    options.push(`JEE Main ${y} January`);
  }
  return options;
}
