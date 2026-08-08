// Core scoring + analytics logic used when an attempt is submitted.
// Kept as pure functions so they're easy to unit test and reuse.

type AnswerRow = {
  questionId: string;
  selectedOptionIds: string[];
  question: {
    subject: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    translations: { language: string; correctOptionIds: string[] }[];
  };
};

export function scoreAnswer(
  selected: string[],
  correct: string[],
  correctMarks: number,
  incorrectMarks: number
): { isCorrect: boolean; marks: number } {
  if (selected.length === 0) return { isCorrect: false, marks: 0 }; // unattempted = 0
  const sortedSel = [...selected].sort();
  const sortedCorrect = [...correct].sort();
  const isCorrect =
    sortedSel.length === sortedCorrect.length &&
    sortedSel.every((v, i) => v === sortedCorrect[i]);
  return { isCorrect, marks: isCorrect ? correctMarks : incorrectMarks };
}

export function buildAnalytics(
  answers: AnswerRow[],
  correctMarks: number,
  incorrectMarks: number
) {
  let totalScore = 0;
  const bySubject: Record<string, { correct: number; incorrect: number; unattempted: number }> = {};
  const byDifficulty: Record<string, { correct: number; incorrect: number; unattempted: number }> = {
    EASY: { correct: 0, incorrect: 0, unattempted: 0 },
    MEDIUM: { correct: 0, incorrect: 0, unattempted: 0 },
    HARD: { correct: 0, incorrect: 0, unattempted: 0 },
  };

  for (const a of answers) {
    const translation =
      a.question.translations.find((t) => t.language === "en") ||
      a.question.translations[0];
    const correct = translation?.correctOptionIds || [];
    const { isCorrect, marks } = scoreAnswer(
      a.selectedOptionIds,
      correct,
      correctMarks,
      incorrectMarks
    );
    totalScore += marks;

    const subj = a.question.subject;
    bySubject[subj] ||= { correct: 0, incorrect: 0, unattempted: 0 };
    const diff = a.question.difficulty;

    if (a.selectedOptionIds.length === 0) {
      bySubject[subj].unattempted++;
      byDifficulty[diff].unattempted++;
    } else if (isCorrect) {
      bySubject[subj].correct++;
      byDifficulty[diff].correct++;
    } else {
      bySubject[subj].incorrect++;
      byDifficulty[diff].incorrect++;
    }
  }

  return { totalScore, bySubject, byDifficulty };
}
