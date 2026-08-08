-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "subTopic" TEXT;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;
