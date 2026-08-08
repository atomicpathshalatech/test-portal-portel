-- CreateTable
CREATE TABLE "RankTrendPoint" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "expectedRank" INTEGER NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankTrendPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankTrendPoint_category_marks_year_key" ON "RankTrendPoint"("category", "marks", "year");
