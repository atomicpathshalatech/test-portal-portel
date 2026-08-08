import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";
import { callGeminiVision, parseJsonResponse } from "@/lib/gemini";

type ExtractSolutionResult = { solution_en?: string; solution_hi?: string; error?: string };

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64) {
    return NextResponse.json({ message: "No image provided" }, { status: 400 });
  }

  const system = `You extract a worked solution/explanation from a screenshot image (e.g. a photo of a
handwritten or printed solution to a NEET/JEE question) and provide it in BOTH English and Hindi.

Transcribe the mathematical/scientific reasoning faithfully — don't just describe it, write out the actual
steps as they appear (or their direct translation). For the Hindi version, use standard NCERT textbook
scientific terminology (not literal/colloquial translation) — e.g. "acceleration" = "त्वरण", "momentum" = "संवेग".

Respond with ONLY valid, parseable JSON — nothing else, no markdown fences. Escape every backslash as \\\\
and every newline as \\n. Write math notation in $...$ LaTeX form.

Example shape: {"solution_en": "Using $F=ma$...", "solution_hi": "$F=ma$ का उपयोग करते हुए..."}

If the image doesn't contain a readable solution, return {"error": "could not read a solution from this image"}.`;

  const user = "Extract the solution/explanation from this image, in both English and Hindi.";

  let raw = "";
  try {
    raw = await callGeminiVision({ system, user, imageBase64, mimeType: mimeType || "image/png", maxTokens: 2000 });
    const parsed = parseJsonResponse<ExtractSolutionResult>(raw);
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
