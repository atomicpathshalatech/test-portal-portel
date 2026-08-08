-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TestStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "TestStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "SectionQuestion" ADD COLUMN     "marksOverride" DOUBLE PRECISION,
ADD COLUMN     "negativeMarksOverride" DOUBLE PRECISION,
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';
