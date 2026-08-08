"use client";
import { renderFormulaContent } from "@/lib/formula";

// Renders text that may contain $inline$ or $$block$$ LaTeX formulas.
// Used both in the admin question editor (live preview) and the student
// exam runtime (so formulas actually show up correctly during the exam).
export default function FormulaText({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderFormulaContent(text || "") }}
    />
  );
}
