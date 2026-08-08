import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

type TranslateResult = {
  statement: string;
  options?: { id: string; text: string }[];
  solution: string;
};

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { subject, sourceLang, statement, options, solution, isIntegerType } = await req.json();
  if (!statement || !sourceLang) {
    return NextResponse.json({ message: "statement and sourceLang are required" }, { status: 400 });
  }
  const targetLang = sourceLang === "hi" ? "en" : "hi";

  const system = `You translate NEET/JEE exam questions between Hindi and English for Atomic Pathshala,
an Indian coaching platform. Translate the question statement, options, and solution from ${sourceLang === "hi" ? "Hindi" : "English"}
into ${targetLang === "hi" ? "Hindi" : "English"}.

${
  targetLang === "hi"
    ? `Use standard NCERT textbook scientific terminology for Hindi — not literal/colloquial translation.
Examples: "acceleration" → "त्वरण", "momentum" → "संवेग", "velocity" → "वेग", "force" → "बल",
"electric field" → "विद्युत क्षेत्र", "concentration" → "सांद्रता". Numbers, chemical formulas, and
mathematical notation stay unchanged.`
    : `Use standard scientific English terminology as used in NCERT English-medium textbooks.`
}

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences. Escape every backslash as \\\\
and every newline as \\n (preserve any $...$ LaTeX notation exactly, just translating surrounding text).

Example shape:
{"statement": "...", ${isIntegerType ? "" : '"options": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}], '}"solution": "..."}`;

  const optionsText = isIntegerType
    ? "(Integer/Numerical type — no options to translate.)"
    : (options || []).map((o: any) => `${o.id}. ${o.text}`).join("\n");

  const user = `Subject: ${subject || "N/A"}

Statement: ${statement}

${optionsText}

Solution: ${solution || "(none provided)"}`;

  let raw = "";
  try {
    raw = await callGemini({ system, user, maxTokens: 1500 });
    const parsed = parseJsonResponse<TranslateResult>(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { message: `${err.message || "Translation failed"}${raw ? ` — AI responded with: ${raw.slice(0, 300)}` : ""}` },
      { status: 500 }
    );
  }
}
