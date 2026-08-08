// AI Coach: a transparent, rule-based analytics engine (not literally an ML
// model) that aggregates a student's answers across ALL their submitted
// attempts and classifies each topic as Weak / Moderate / Strong based on
// accuracy — so recommendations are explainable, not a black box.

type AnswerRow = {
  selectedOptionIds: unknown;
  isCorrect: boolean | null;
  question: {
    subject: string;
    topic: string | null;
    translations: { language: string; correctOptionIds: unknown }[];
  };
};

export type TopicStat = {
  key: string; // "Subject / Topic"
  subject: string;
  topic: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  attempted: number;
  accuracy: number; // 0-100, based on attempted questions only
  band: "WEAK" | "MODERATE" | "STRONG" | "INSUFFICIENT_DATA";
  tip: string;
};

const MIN_ATTEMPTED_FOR_VERDICT = 2;

export function buildTopicStats(answers: AnswerRow[]): TopicStat[] {
  const map = new Map<string, { subject: string; topic: string; correct: number; incorrect: number; unattempted: number }>();

  for (const a of answers) {
    const subject = a.question.subject;
    const topic = a.question.topic || "General";
    const key = `${subject} / ${topic}`;
    const bucket = map.get(key) || { subject, topic, correct: 0, incorrect: 0, unattempted: 0 };

    const selected = Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : [];
    if (selected.length === 0) {
      bucket.unattempted++;
    } else if (a.isCorrect) {
      bucket.correct++;
    } else {
      bucket.incorrect++;
    }
    map.set(key, bucket);
  }

  const stats: TopicStat[] = Array.from(map.entries()).map(([key, b]) => {
    const attempted = b.correct + b.incorrect;
    const accuracy = attempted > 0 ? Math.round((b.correct / attempted) * 1000) / 10 : 0;

    let band: TopicStat["band"];
    let tip: string;
    if (attempted < MIN_ATTEMPTED_FOR_VERDICT) {
      band = "INSUFFICIENT_DATA";
      tip = "Attempt a few more questions on this topic to get a reliable verdict.";
    } else if (accuracy >= 75) {
      band = "STRONG";
      tip = "Solid grasp — keep it up with periodic revision, focus your time elsewhere.";
    } else if (accuracy >= 50) {
      band = "MODERATE";
      tip = "Getting there — revise the core concepts and attempt more practice questions.";
    } else {
      band = "WEAK";
      tip = "Priority area — revisit fundamentals and do focused practice before your next test.";
    }

    return {
      key,
      subject: b.subject,
      topic: b.topic,
      correct: b.correct,
      incorrect: b.incorrect,
      unattempted: b.unattempted,
      attempted,
      accuracy,
      band,
      tip,
    };
  });

  // Weakest first (most actionable), insufficient-data topics last
  return stats.sort((a, b) => {
    const order = { WEAK: 0, MODERATE: 1, STRONG: 2, INSUFFICIENT_DATA: 3 };
    if (order[a.band] !== order[b.band]) return order[a.band] - order[b.band];
    return a.accuracy - b.accuracy;
  });
}
