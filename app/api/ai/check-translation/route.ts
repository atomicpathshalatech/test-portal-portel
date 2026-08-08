import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGemini, parseJsonResponse } from "@/lib/gemini";

type Result = {
  verdict: "ACCURATE" | "PARTIALLY_ACCURATE" | "INACCURATE";
  issues: string;
  improvedHindiStatement?: string;
  improvedHindiOptions?: { id: string; text: string }[];
  improvedHindiSolution?: string;
};

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { hindiStatement, englishStatement, hindiOptions, englishOptions, hindiSolution, englishSolution } = await req.json();
  if (!hindiStatement || !englishStatement) {
    return NextResponse.json({ message: "Both Hindi and English statements are required" }, { status: 400 });
  }

  const system = `You check whether a Hindi translation of a NEET/JEE exam question (and its solution)
accurately conveys the same meaning as its English original — not word-for-word, but the same scientific
meaning, same numbers/units/variables, and same set of options in the same order.

Critically, also verify the Hindi uses STANDARD NCERT TEXTBOOK scientific terminology, not literal or
colloquial translation. Examples of correct NCERT terms: "acceleration" = "त्वरण" (not "गति बढ़ना"),
"momentum" = "संवेग" (not "गति की मात्रा"), "velocity" = "वेग", "electric field" = "विद्युत क्षेत्र",
"concentration" = "सांद्रता". Flag any place where the Hindi uses a non-standard or overly literal term
instead of the accepted NCERT term.

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences. Escape every backslash as \\\\
and every newline as \\n.

If the verdict is "ACCURATE", respond with just:
{"verdict": "ACCURATE", "issues": ""}

If the verdict is "PARTIALLY_ACCURATE" or "INACCURATE", ALSO include a corrected Hindi version so it can
be applied with one click:
{"verdict": "INACCURATE", "issues": "brief description of what's wrong, under 20 words", "improvedHindiStatement": "...", "improvedHindiOptions": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}], "improvedHindiSolution": "..."}

Omit "improvedHindiOptions" entirely if this is an Integer/Numerical question with no options.`;

  const user = `English Statement: ${englishStatement}
English Options: ${(englishOptions || []).map((o: any) => `${o.id}. ${o.text}`).join(" | ")}
English Solution: ${englishSolution || "(none)"}

Hindi Statement: ${hindiStatement}
Hindi Options: ${(hindiOptions || []).map((o: any) => `${o.id}. ${o.text}`).join(" | ")}
Hindi Solution: ${hindiSolution || "(none)"}`;

  let raw = "";
  try {
    raw = await callGemini({ system, user, maxTokens: 1500 });
    const parsed = parseJsonResponse<Result>(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { message: `${err.message || "Translation check failed"}${raw ? ` — AI responded with: ${raw.slice(0, 300)}` : ""}` },
      { status: 500 }
    );
  }
}
