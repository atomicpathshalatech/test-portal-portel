/*
  Warnings:

  - Added the required column `subject` to the `Section` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "tags" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "marksPerQuestion" DOUBLE PRECISION,
ADD COLUMN     "negativeMarks" DOUBLE PRECISION,
ADD COLUMN     "subject" TEXT NOT NULL,
ADD COLUMN     "targetCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "description" TEXT,
ADD COLUMN     "examType" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "questionFormat" TEXT NOT NULL DEFAULT 'OBJECTIVE',
ADD COLUMN     "testType" TEXT;

-- AlterTable
ALTER TABLE "TestSeries" ADD COLUMN     "className" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "examType" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';
