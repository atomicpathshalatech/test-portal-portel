// Predicts an approximate All-India Rank from marks, by linearly
// interpolating between admin-curated historical trend points
// (previous year's actual marks-vs-rank data).
//
// This is explicitly an ESTIMATE — NTA does not publish an official rank
// calculator. Accuracy depends on how current the admin-entered trend data
// is; update RankTrendPoint data every year once official results are out.

export type TrendPoint = { marks: number; expectedRank: number };

export function predictRank(
  points: TrendPoint[],
  inputMarks: number
): { rank: number; isExtrapolated: boolean } | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.marks - b.marks);

  if (sorted.length === 1) {
    return { rank: sorted[0].expectedRank, isExtrapolated: inputMarks !== sorted[0].marks };
  }

  // Below the lowest known point — extrapolate using the first two points.
  if (inputMarks <= sorted[0].marks) {
    const [p0, p1] = sorted;
    const slope = (p1.expectedRank - p0.expectedRank) / (p1.marks - p0.marks);
    const rank = Math.round(p0.expectedRank + slope * (inputMarks - p0.marks));
    return { rank: Math.max(1, rank), isExtrapolated: true };
  }

  // Above the highest known point — extrapolate using the last two points.
  const last = sorted[sorted.length - 1];
  if (inputMarks >= last.marks) {
    const prev = sorted[sorted.length - 2];
    const slope = (last.expectedRank - prev.expectedRank) / (last.marks - prev.marks);
    const rank = Math.round(last.expectedRank + slope * (inputMarks - last.marks));
    return { rank: Math.max(1, rank), isExtrapolated: true };
  }

  // Within range — interpolate between the two bracketing points.
  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (inputMarks >= p0.marks && inputMarks <= p1.marks) {
      const t = p1.marks === p0.marks ? 0 : (inputMarks - p0.marks) / (p1.marks - p0.marks);
      const rank = Math.round(p0.expectedRank + t * (p1.expectedRank - p0.expectedRank));
      return { rank: Math.max(1, rank), isExtrapolated: false };
    }
  }

  return null;
}
