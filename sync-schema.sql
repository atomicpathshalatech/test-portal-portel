-- ============================================================
-- Atomic Test Portal — Full schema sync (idempotent)
-- Safe to run even if some of this is already applied — every
-- statement checks for existence first, so nothing breaks and
-- nothing is duplicated.
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ---------- ENUM UPDATES ----------
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEACHER';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "TestStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "TestStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "TestStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'STATEMENT_BASED';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'MATCH_COLUMN';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'ASSERTION_REASON';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ---------- User ----------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subject" TEXT;

-- ---------- TestSeries ----------
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "tags" TEXT;
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "examType" TEXT;
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "course" TEXT;
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "className" TEXT;
ALTER TABLE "TestSeries" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- ---------- Test ----------
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "testType" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "examType" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "questionFormat" TEXT NOT NULL DEFAULT 'OBJECTIVE';
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "reminder15SentAt" TIMESTAMP(3);
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "startNotifiedAt" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "Test" ADD CONSTRAINT "Test_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Section ----------
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "targetCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "marksPerQuestion" DOUBLE PRECISION;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "negativeMarks" DOUBLE PRECISION;

-- ---------- Question ----------
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "questionCode" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "subTopic" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "pyqSource" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "solution" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "tags" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "publishedById" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
DO $$ BEGIN
  CREATE UNIQUE INDEX "Question_questionCode_key" ON "Question"("questionCode");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- QuestionTranslation ----------
ALTER TABLE "QuestionTranslation" ADD COLUMN IF NOT EXISTS "solution" TEXT;

-- ---------- SectionQuestion ----------
ALTER TABLE "SectionQuestion" ADD COLUMN IF NOT EXISTS "marksOverride" DOUBLE PRECISION;
ALTER TABLE "SectionQuestion" ADD COLUMN IF NOT EXISTS "negativeMarksOverride" DOUBLE PRECISION;
ALTER TABLE "SectionQuestion" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- ---------- New tables ----------
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Bookmark" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "Bookmark_studentId_questionId_key" ON "Bookmark"("studentId", "questionId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QuestionVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "questionId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "editedById" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "changeType" TEXT NOT NULL DEFAULT 'EDIT',
  "snapshot" JSONB NOT NULL
);
DO $$ BEGIN
  CREATE UNIQUE INDEX "QuestionVersion_questionId_versionNumber_key" ON "QuestionVersion"("questionId", "versionNumber");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QuestionReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "questionId" TEXT NOT NULL,
  "testId" TEXT,
  "reasonTags" TEXT NOT NULL,
  "comment" TEXT,
  "screenshotUrl" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "reportedById" TEXT NOT NULL,
  "claimedById" TEXT,
  "claimedAt" TIMESTAMP(3),
  "teacherNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
DO $$ BEGIN
  ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TestTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "TestTemplate" ADD CONSTRAINT "TestTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TestTemplateSection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "marksPerQuestion" DOUBLE PRECISION,
  "negativeMarks" DOUBLE PRECISION,
  "order" INTEGER NOT NULL DEFAULT 0
);
DO $$ BEGIN
  ALTER TABLE "TestTemplateSection" ADD CONSTRAINT "TestTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Done. After running this, go back to your terminal and run:
--   npx prisma generate
-- (no database connection needed for that command — it only
-- reads your local schema.prisma file)
-- ============================================================
