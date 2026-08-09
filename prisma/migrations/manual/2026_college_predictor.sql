-- Run this in Supabase Dashboard -> SQL Editor -> "Run without RLS"
-- (idempotent — safe to run more than once)

-- 1. New metadata columns on RankTrendPoint, so the predictor can show
--    "EXACT (official NTA data)" vs "DERIVED" vs "ESTIMATED" per point.
ALTER TABLE "RankTrendPoint" ADD COLUMN IF NOT EXISTS "confidence" TEXT;
ALTER TABLE "RankTrendPoint" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- 2. New CollegeAllotment table — real previous-year rank -> college
--    outcomes, powers the College Predictor feature.
CREATE TABLE IF NOT EXISTS "CollegeAllotment" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" TEXT NOT NULL DEFAULT 'Round 1',
    "rank" INTEGER NOT NULL,
    "quota" TEXT NOT NULL,
    "instituteName" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "allottedCategory" TEXT NOT NULL,
    "candidateCategory" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollegeAllotment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CollegeAllotment_year_rank_idx" ON "CollegeAllotment"("year", "rank");
CREATE INDEX IF NOT EXISTS "CollegeAllotment_year_course_allottedCategory_idx" ON "CollegeAllotment"("year", "course", "allottedCategory");
