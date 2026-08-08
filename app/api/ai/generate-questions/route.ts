import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

type GeneratedQuestion = {
  statement_en?: string;
  options_en?: { id: string; text: string }[];
  statement_hi?: string;
  options_hi?: { id: string; text: string }[];
  correctOptionId: string;
  solution_en?: string;
  solution_hi?: string;
};

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { subject, chapter, topic, difficulty, languageMode, count } = await req.json();
  if (!subject || !chapter || !difficulty) {
    return NextResponse.json({ message: "subject, chapter and difficulty are required" }, { status: 400 });
  }
  const n = Math.min(Math.max(Number(count) || 1, 1), 5); // cap at 5 per request — keeps latency/cost sane

  const wantsEn = languageMode === "ENGLISH" || languageMode === "BOTH";
  const wantsHi = languageMode === "HINDI" || languageMode === "BOTH";

  const exampleFields: string[] = [];
  if (wantsEn) exampleFields.push('"statement_en": "...", "options_en": [{"id":"A","text":"..."}, {"id":"B","text":"..."}, {"id":"C","text":"..."}, {"id":"D","text":"..."}]');
  if (wantsHi) exampleFields.push('"statement_hi": "...", "options_hi": [{"id":"A","text":"..."}, {"id":"B","text":"..."}, {"id":"C","text":"..."}, {"id":"D","text":"..."}]');
  exampleFields.push('"correctOptionId": "A"');
  if (wantsEn) exampleFields.push('"solution_en": "step-by-step working"');
  if (wantsHi) exampleFields.push('"solution_hi": "चरणबद्ध हल"');
  const exampleQuestion = `{${exampleFields.join(", ")}}`;

  const system = `You are an expert NEET question setter writing original, exam-quality multiple-choice
questions strictly at ${difficulty} difficulty for NCERT-based NEET preparation. Each question must have
exactly 4 options (A-D) with exactly one correct answer, be factually accurate, and not be a copy of a
well-known previous year question verbatim.

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences, no preamble, no trailing
commas. Here is a concrete example of the exact shape to return, with ${n} question(s) in the array (this
is only an illustrative example — use your own actual questions):
{"questions": [${exampleQuestion}]}

Escape every backslash as \\\\ (LaTeX like \\frac must appear as \\\\frac inside the JSON string) and every
newline as \\n — statements/options/solutions will contain LaTeX and must remain valid JSON.
Use $...$ for inline LaTeX and $$...$$ for display LaTeX in statements/options/solutions where relevant
(e.g. "$F = ma$"). Generate exactly ${n} question(s).`;

  const user = `Subject: ${subject}
Chapter: ${chapter}
Topic: ${topic || "any topic within this chapter"}
Difficulty: ${difficulty}`;

  let raw = "";
  try {
    raw = await callGemini({ system, user, maxTokens: 4000 });
    const parsed = parseJsonResponse<{ questions: GeneratedQuestion[] }>(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      {
        message: `${err.message || "AI generation failed"}${raw ? ` — AI responded with: ${raw.slice(0, 300)}` : ""}`,
      },
      { status: 500 }
    );
  }
}
