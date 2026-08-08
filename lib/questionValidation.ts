type TranslationInput = {
  statement?: string;
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  solution?: string;
};

// Server-side mirror of the client's strict validation (Rule C): chapter,
// topic are mandatory, and every enabled language must have a complete
// statement + options + correct answer + its own solution.
export function validateQuestionPayload(body: {
  chapter?: string;
  topic?: string;
  subTopic?: string;
  type?: string;
  translations?: { hi?: TranslationInput; en?: TranslationInput };
}): string | null {
  if (!body.chapter) return "Chapter is required.";
  if (!body.topic) return "Topic is required.";

  const isIntegerType = body.type === "INTEGER" || body.type === "NUMERICAL";
  const langs: { key: "hi" | "en"; label: string; data?: TranslationInput }[] = [
    { key: "hi", label: "Hindi", data: body.translations?.hi },
    { key: "en", label: "English", data: body.translations?.en },
  ];

  let anyEnabled = false;
  for (const l of langs) {
    if (!l.data) continue;
    anyEnabled = true;
    if (!l.data.statement || !l.data.statement.trim()) return `${l.label} statement is required.`;
    if (!l.data.solution || !l.data.solution.trim()) return `${l.label} solution is required.`;
    if (isIntegerType) {
      if (!l.data.correctOptionIds?.[0] || !String(l.data.correctOptionIds[0]).trim()) {
        return `${l.label}: a correct value is required.`;
      }
    } else {
      const options = l.data.options || [];
      const emptyOption = options.find((o) => !o.text || !o.text.trim());
      if (emptyOption) return `${l.label}: Option ${emptyOption.id} cannot be empty.`;
      if (!l.data.correctOptionIds || l.data.correctOptionIds.length === 0) {
        return `${l.label}: a correct option is required.`;
      }
    }
  }
  if (!anyEnabled) return "At least one language translation is required.";

  return null;
}
