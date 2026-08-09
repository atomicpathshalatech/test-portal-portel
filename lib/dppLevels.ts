export type DppLevel = {
  level: number;
  name: string;
  description: string;
  suggestedTypes: string[]; // QuestionType values this level is meant to use
};

export const DPP_LEVELS: DppLevel[] = [
  {
    level: 1,
    name: "CONCEPTUAL QUESTIONS",
    description: "Strengthen your basics with concept based questions and build a strong foundation.",
    suggestedTypes: ["SINGLE_CORRECT"],
  },
  {
    level: 2,
    name: "STATEMENTWISE & ASSERTION REASON",
    description: "Practice statement based questions and assertion reason type for deeper understanding.",
    suggestedTypes: ["STATEMENT_BASED", "ASSERTION_REASON"],
  },
  {
    level: 3,
    name: "MATCH THE COLUMN & MULTIPLE CORRECT / INCORRECT STATEMENT",
    description: "Enhance your accuracy with the match the column and multiple correct / incorrect statement questions.",
    suggestedTypes: ["MATCH_COLUMN", "MULTIPLE_CORRECT"],
  },
  {
    level: 4,
    name: "MOST EXPECTED QUESTIONS",
    description: "Focus on highly expected questions from important topics and previous trends.",
    suggestedTypes: ["SINGLE_CORRECT", "MULTIPLE_CORRECT", "INTEGER"],
  },
  {
    level: 5,
    name: "TEACHERS FAVORITE QUESTIONS",
    description: "Handpicked high quality questions by our educators that make the real difference.",
    suggestedTypes: ["SINGLE_CORRECT", "MULTIPLE_CORRECT", "INTEGER", "MATCH_COLUMN", "ASSERTION_REASON", "STATEMENT_BASED"],
  },
];

export function getDppLevel(level: number | null | undefined): DppLevel | null {
  if (!level) return null;
  return DPP_LEVELS.find((l) => l.level === level) || null;
}
