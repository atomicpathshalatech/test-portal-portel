import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGeminiVision, parseJsonResponse } from "@/lib/gemini";

type ExtractResult = {
  statement_en?: string;
  options_en?: { id: string; text: string }[];
  statement_hi?: string;
  options_hi?: { id: string; text: string }[];
  isIntegerType?: boolean;
  correctValueGuess?: string | null;
  hasImage?: boolean;
};

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64) {
    return NextResponse.json({ message: "No image provided" }, { status: 400 });
  }

  const system = `You extract exam question TEXT from a screenshot image. The image may contain a
multiple-choice question in English, Hindi, or both side-by-side (bilingual NEET-style papers commonly
show Hindi and English versions of the same question together — extract BOTH if present). It may also be
an Integer/Numerical type question with no options.

IMPORTANT — careful separation of text vs. diagram: extract ONLY the printed/typed text (the question
wording, numbers, option text) into the statement/options fields. Do NOT try to describe or transcribe any
circuit diagram, graph, chemical structure drawing, biological figure, or other non-text image content —
you cannot reproduce an image as text. If the question visibly includes such a diagram/figure (i.e. the
question can't be understood from text alone), set "hasImage": true so the person extracting knows to
separately upload that diagram as an image. If there's no diagram, set "hasImage": false.

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences. Escape every backslash as \\\\
and every newline as \\n (the statement may contain math notation — write it in $...$ LaTeX form, e.g. "$x^2$").

Concrete example of the exact shape (include only the language(s) actually present in the image):
{
  "statement_en": "...", "options_en": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
  "statement_hi": "...", "options_hi": [{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],
  "isIntegerType": false,
  "correctValueGuess": null,
  "hasImage": false
}

If it's an Integer/Numerical question (no A/B/C/D options, just a blank/box for a numeric answer), set
"isIntegerType": true, omit the options arrays, and leave "correctValueGuess" as null (do not guess the
answer — only extract what's visibly printed as the answer if one is shown, e.g. in an answer key screenshot).
If the image is unclear or not a question at all, return {"statement_en": "", "error": "could not read a question from this image"}.`;

  const user = "Extract the question from this screenshot.";

  let raw = "";
  try {
    raw = await callGeminiVision({ system, user, imageBase64, mimeType: mimeType || "image/png", maxTokens: 2000 });
    const parsed = parseJsonResponse<ExtractResult & { error?: string }>(raw);
    if (parsed.error) {
      return NextResponse.json({ message: parsed.error }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { message: `${err.message || "Extraction failed"}${raw ? ` — AI responded with: ${raw.slice(0, 300)}` : ""}` },
      { status: 500 }
    );
  }
}
