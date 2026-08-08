import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

type SolveResult = {
  correctOptionId: string | null;
  solution?: string;
  solution_en?: string;
  solution_hi?: string;
  confidence: "high" | "medium" | "low";
};

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { subject, chapter, topic, statement, options, language, questionType } = await req.json();
  if (!statement || !options || options.length === 0) {
    return NextResponse.json({ message: "statement and options are required" }, { status: 400 });
  }

  const isIntegerType = questionType === "INTEGER" || questionType === "NUMERICAL";
  const wantsBoth = language === "both";

  const system = `You are an expert NEET (Physics/Chemistry/Biology) exam question solver with deep subject
knowledge. You will be given a question and its options. Work through it carefully and rigorously —
double-check any calculation before answering, since accuracy matters a lot here.

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences, no preamble, no trailing
comments. "correctOptionId" must be ${isIntegerType ? "a string containing the exact numeric answer, e.g. \"42\"" : 'one of "A", "B", "C", "D", or null if genuinely undeterminable'}.
"confidence" must be exactly one of "high", "medium", or "low".

${
  wantsBoth
    ? `Provide the solution in BOTH languages as two SEPARATE fields — "solution_en" (English) and
"solution_hi" (Hindi, using standard NCERT textbook scientific terminology, not literal/colloquial
translation — e.g. "acceleration" as "त्वरण", "momentum" as "संवेग", "velocity" as "वेग"). Both must
explain the identical reasoning.
Example: {"correctOptionId": ${isIntegerType ? '"42"' : '"B"'}, "solution_en": "Using $F = ma$...", "solution_hi": "$F = ma$ का उपयोग करते हुए...", "confidence": "high"}`
    : `Provide the solution in a single "solution" field, written in ${language === "hi" ? "Hindi (using standard NCERT textbook scientific terminology, not literal/colloquial translation)" : "English"}.
Example: {"correctOptionId": ${isIntegerType ? '"42"' : '"B"'}, "solution": "Using $F = ma$, we get...", "confidence": "high"}`
}

Escape every backslash as \\\\ (LaTeX like \\frac must appear as \\\\frac inside the JSON string) and every
newline as \\n — the solution text will contain LaTeX and must remain valid JSON.
Use $...$ for inline LaTeX and $$...$$ for display LaTeX in the solution text (e.g. "$F = ma$").
Set confidence to "low" if the question is ambiguous, has insufficient information (e.g. depends on a
diagram/image you cannot see), or you are not fully sure of the answer — never guess with high confidence.`;

  const optionsText = isIntegerType
    ? "(This is an Integer/Numerical answer type — there are no options; determine the exact numeric answer.)"
    : options.map((o: any) => `${o.id}. ${o.text}`).join("\n");

  const user = `Subject: ${subject}
Chapter: ${chapter || "N/A"}
Topic: ${topic || "N/A"}

Question: ${statement}

${optionsText}`;

  let raw = "";
  try {
    raw = await callGemini({ system, user, maxTokens: 3000 });
    const parsed = parseJsonResponse<SolveResult>(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    const looksTruncated = raw.trim().length > 0 && !raw.trim().endsWith("}");
    const message = looksTruncated
      ? "The AI's response was cut off before it finished (the solution was too long). Try again — this is usually a one-off."
      : err.message || "AI solve failed";
    return NextResponse.json(
      { message: `${message}${raw ? ` — AI responded with: ...${raw.slice(-300)}` : ""}` },
      { status: 500 }
    );
  }
}
