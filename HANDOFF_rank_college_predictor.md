# This turn — Rank Predictor + College Predictor (NEET data)

## What was added

1. **Schema** (`prisma/schema.prisma`)
   - `RankTrendPoint`: added optional `confidence` (`EXACT` | `DERIVED` | `ESTIMATED` | null-for-manual) and `source` columns — backward compatible, no data loss.
   - New `CollegeAllotment` model — previous-year AIQ Round-1 rank→college seat allotments.

2. **SQL to run** — paste `prisma/migrations/manual/2026_college_predictor.sql` into Supabase Dashboard → SQL Editor → Run without RLS (idempotent, safe to re-run).

3. **After the SQL is applied, locally:**
   ```
   npx prisma generate
   npx tsx scripts/importNeetData.ts
   ```
   (If `tsx` isn't installed: `npm install -D tsx` first, or swap for `ts-node`.)
   This loads:
   - `prisma/seed-data/college-allotment-2025-round1.csv` (26,343 rows)
   - `prisma/seed-data/college-allotment-2024-round1.csv` (25,743 rows)
   - `prisma/seed-data/rank-trend-2026.json` (53 official 2026 Re-NEET anchor points)

4. **New API**: `GET /api/college-predictor?rank=&category=&course=&year=` — returns nearest previous-year allotment rows to a given rank.

5. **UI**: `/student/rank-predictor` now has two tabs — existing "Marks → Rank" and new "Rank → College". Admin `/admin/rank-trend` shows an EXACT/DERIVED badge next to imported points.

## Data provenance & honesty notes

- The 2026 marks↔AIR anchor points are **all from one official NTA document** (`20260716180970800.pdf`, "List of Top 138 candidates... + marks/rank statistics", signed by Director NEET-Confidential, NTA). None of the earlier "reconstructed" third-party estimate was used for seeding — only this genuine document, plus two facts verified via web search (686/720 AIR1 for 2025 topper, 715/720 joint AIR1 for 2026 — used only for cross-checking, not seeded as 2025 data since we don't have a matching official 2025 anchor document yet).
- `EXACT` points = numbers printed verbatim in that PDF. `DERIVED` points = computed by cumulatively summing the PDF's own 50-mark bucket candidate-counts (mathematically bound by official totals, not guessed).
- **2025 has no equivalent anchor data seeded yet** — only 2026. If a same-format official "marks/rank statistics" PDF for NEET 2025 turns up, send it and I'll seed that year too.
- The College Predictor is **2024 & 2025 Round 1 only** (real MCC data, not predictions). No 2026 counselling data exists yet — MCC counselling for 2026 was expected to start ~August 2026 per news reports at the time.
- `RankTrendPoint` "General" category = **overall AIR** (Open/UR candidates compete directly on this in AIQ). OBC/SC/ST/EWS categories still have **no seeded data** — NTA does not publicly release a category-wise marks→rank mapping, so those remain empty until an admin enters manual estimates.

## Known parser limitations (college-allotment CSVs)

- Parsed via a vocabulary-based text parser (not a generic table extractor) against the two ~1,100-page iTextSharp-generated PDFs — reached ~99% row coverage (26,343/26,608 for 2025; 25,743/26,109 for 2024). The remaining ~1% failed to parse cleanly (rare institute-address line-wrap edge cases) and were skipped rather than guessed.
- Occasionally the `instituteName` field has a trailing stray "PwD" from address-continuation text bleeding in — cosmetic only, doesn't affect rank/course/category accuracy.
