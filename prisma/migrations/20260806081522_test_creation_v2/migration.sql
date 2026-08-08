/*
  Warnings:

  - A unique constraint covering the columns `[questionCode]` on the table `Question` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "category" TEXT,
ADD COLUMN     "pyqSource" TEXT,
ADD COLUMN     "questionCode" TEXT,
ADD COLUMN     "solution" TEXT,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "reminder15SentAt" TIMESTAMP(3),
ADD COLUMN     "startNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestSeries" ADD COLUMN     "tags" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
