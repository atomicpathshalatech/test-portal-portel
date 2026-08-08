# Atomic Test Portal — MVP

5-din ke andar deployable core version: Test Series → Test Creation (bilingual, scheduling, marking) →
Question Bank (Hindi+English) → Student Exam Runtime (NTA-style palette, timer, language toggle,
fullscreen + tab-switch violation tracking) → Result (subject-wise & difficulty-wise breakdown + rank).

## 1. Local Setup (Din 1)

```bash
npm install
cp .env.example .env
# .env me DATABASE_URL aur JWT_SECRET fill karein (Supabase steps neeche)
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open http://localhost:3000

Seed accounts (all password: `password123`):
- **Super Admin**: `admin@atp.test` — full access to everything
- **Sub Admin**: `subadmin@atp.test` — manages users/tests/questions, approves & publishes tests, cannot touch system settings
- **Teacher (Physics)**: `physics.teacher@atp.test` — can only see/create Physics questions, creates tests as drafts and submits for approval
- **Student**: `student@atp.test`

## 1a. Role-Based Access Control (RBAC)

Four roles, permissions flow strictly top → bottom (a lower role never gets a higher role's access):

```
SUPER_ADMIN (exactly one, seeded — cannot be created via the UI)
    ↓
SUB_ADMIN   (created by Super Admin)
    ↓
TEACHER     (created by Super/Sub Admin, scoped to one subject)
    ↓
STUDENT
```

- **Question Bank**: a Teacher only ever sees/creates questions in their own assigned subject — enforced server-side, not just hidden in the UI.
- **Test Approval Workflow**: every test starts as `DRAFT`. A Teacher (or manager) submits it for approval (`PENDING_APPROVAL`); only Sub Admin / Super Admin can approve & publish (`PUBLISHED`). **Students only ever see PUBLISHED tests** — draft/pending tests are invisible to them and blocked at the API level even if someone guesses the URL.
- **User Management** (`/admin/users`): Super Admin can create Sub Admin/Teacher/Student; Sub Admin can create Teacher/Student only.
- **Audit Logs** (`/admin/audit-logs`): every create/publish/approve/policy-change action is recorded with who did it and when.
- **System settings** (multi-login policy) are Super-Admin-only.

**Not included in this pass** (flagging clearly, per the original RBAC doc):
- Academic Management as separate manageable entities (Classes/Chapters/Topics beyond the existing free-text Subject/Topic fields on questions)
- Website CMS
- Soft-delete / Trash / Restore workflow (deletes are currently permanent where they exist at all)
- Further sub-roles (Content Reviewer, Result Manager, etc.) — the architecture (`lib/permissions.ts`) is designed so these can be added later without a rewrite


## 2. Supabase Database Setup (~10 min)

1. https://supabase.com → New Project banayein.
2. Project Settings → Database → Connection String → **URI** copy karein.
3. Password apne project password se replace karein.
4. Ye string `.env` me `DATABASE_URL` me paste karein.
5. `npx prisma migrate dev --name init` chalayein — sab tables Supabase me create ho jayenge.

## 2b. Image Upload Setup (Question diagrams/graphs) — ~5 min

1. Supabase dashboard me apne project ke andar left sidebar → **Storage** pe click karein.
2. **New bucket** banayein, naam do: `question-images`.
3. Bucket create karte waqt **"Public bucket"** toggle ON kar dein (taaki exam ke time images seedhe load ho sakein bina auth ke).
4. Ab **Project Settings → API** pe jaayein:
   - **Project URL** copy karke `.env` me `SUPABASE_URL` me daalein.
   - **service_role** key (secret, "Reveal" pe click karke dikhega) copy karke `.env` me `SUPABASE_SERVICE_ROLE_KEY` me daalein.
   - ⚠️ Ye `service_role` key kabhi bhi frontend code ya GitHub public repo me commit na karein — sirf server-side (.env, aur Vercel env variables) me hi rahe.
5. `npm install` dobara chalayein (naya `@supabase/supabase-js` package aaya hai) aur `npm run dev` restart karein.

Ab Admin → Question Bank → New Question page pe image upload option kaam karega.

## 3. Deploy to Vercel (~10 min)

1. Is code ko GitHub repo me push karein.
2. https://vercel.com → New Project → apna repo import karein.
3. Environment Variables me `DATABASE_URL` aur `JWT_SECRET` add karein (same values jo `.env` me hain).
4. Build command already `package.json` me set hai (`prisma generate && next build`).
5. Deploy → 2-3 min me live URL milega.
6. Deploy hone ke baad, ek baar seed data dalne ke liye (optional): Vercel project → Terminal/local se
   `DATABASE_URL="<production-url>" npm run db:seed` chalayein.

## 4. Feature Scope (5-Day MVP)

**Included:**
- Test Series create
- Test create — scheduling (open/close time, duration), marking scheme, syllabus (subject-wise question selection), language mode (Hindi / English / Both)
- Question Bank — bilingual editor (Hindi + English statement & options per question), Subject/Topic/Type/Difficulty, optional shared diagram/image upload (via Supabase Storage)
- Student exam runtime — NTA-style question palette, per-question timer-safe navigation, top-right language toggle (NTA jaisa), auto-save on every answer, fullscreen lock, tab-switch/fullscreen-exit detection with weighted Exam Integrity Score, question diagram rendering, KaTeX math/chemistry formulas
- Result — total score, rank (out of total attempted), subject-wise breakdown, difficulty-wise (Easy/Medium/Hard) breakdown
- Security Center (Admin) — per-attempt violation timeline, weighted Exam Integrity Score, suspicious-session flagging
- Rank Predictor — Admin enters previous-year marks-vs-rank trend points per category (General/OBC/SC/ST/EWS); Student enters marks and gets an estimated rank range with a confidence level and a clear "not an official NTA prediction" disclaimer
- Leaderboard — per-test ranked list, filterable by State/City/Institute/Batch, current student's row highlighted
- AI Coach — topic-wise Weak/Moderate/Strong breakdown aggregated across all of a student's submitted attempts, with plain-language focus tips (rule-based and explainable, not a black-box model)
- PDF Export (Admin) — Question Paper and Solution Key as downloadable PDFs, rendered with the exact same fonts/formulas/layout as the live exam (Inter + Noto Sans Devanagari, KaTeX formulas), bilingual side-by-side layout with cover page for "Both" language tests
- Device Fingerprinting & Multi-Login Control — every login records browser/OS/screen/timezone; Admin-configurable policy (Single Session / One Mobile + One Web / Unlimited), enforced even mid-exam within ~30s
- Reports Export (Admin) — Rank List / Result Report with subject-wise correct/incorrect/unattempted breakdown, exportable as Excel (.xlsx) or CSV, alongside the PDF question paper/solution export
- Question ID System — every question gets a permanent unique ID (e.g. `PH10025` — 2-letter subject prefix + 5 digits); import any question into a test instantly by pasting its ID, or bulk-import all questions from a previous test
- PYQ Categorization — tag questions as PYQ/Practice/Module/Assignment, with a Source Exam & Year dropdown (NEET 2017–2026, AIPMT 1988–2016, JEE Main 2020–2025 Jan/April)
- Auto-Calculated Test End Time — set only the start time + duration; end time is computed automatically, never entered manually
- Test Reminders — students get a notification 15 minutes before a test opens and again the moment it goes live (via a Vercel Cron job, see setup below)
- Post-Test Review & Correction (`/admin/tests/[id]/review`) — see question-wise correct/incorrect/unattempted stats, fix a wrong answer key or add a solution, then recalculate every student's score/rank in one click (they're notified automatically if their result changed)
- Logo integration — the uploaded Atomic Pathshala logo appears across the UI (sidebar, login, favicon) and as a watermark on every exported PDF (Question Paper, Solution, Certificate)
- **Two-Step Test Creation** — matches the "test creation never asks for questions" rule: Step 1 (`/admin/tests/builder`) captures only test metadata and defines sections with a target question count (e.g. "Physics — 45 questions"); Step 2 ("Open Test" → `/admin/tests/[id]/add-questions`) shows section-by-section progress (e.g. `28/45`), and clicking into a section gives three question-entry options — Create New (subject auto-locked to that section), Import from Question Bank (filtered to that subject, searchable by ID/text), and Import from a Previous Test's matching-subject section (bulk import)
- **Series Detail Pages** — Admin (`/admin/test-series/[id]`) and Student (`/student/series/[id]`) each get a proper series landing page with banner, stats, and a test list — student dashboard now groups tests by series too
- **Chapter → Topic Cascading Dropdowns** — full NCERT Class 11+12 syllabus for Physics, Chemistry, Botany, Zoology baked in (`lib/syllabusData.ts`); selecting a Chapter filters the Topic dropdown automatically
- **More Question Types** — Statement Based, Match the Column, and Assertion Reason added alongside Single/Multiple Correct; selecting Integer or Numerical swaps the 4-option UI for a single "Correct Value" input
- **Richer Formula Editor** — a categorized symbol picker (Fraction, Script, Radical, Integral, Large Operator, Bracket, Function, Accent, Limit and Log, Operator, Matrix, plus Basic Math/Greek Letters/Arrows grids) replaces the old inline snippet row, available on the statement, every option, and the solution field. You can also paste an image directly into any of these boxes (Ctrl+V) — it uploads automatically and renders inline

- **AI-Assisted Question Authoring** — while writing a question, click "✨ Solve with AI" to have Gemini verify the correct answer and draft a solution (shows a confidence level and flags if it disagrees with what you marked); separately, "✨ AI Generate" (`/admin/questions/ai-generate`) drafts brand-new questions for a chosen subject/chapter/difficulty for you to review, edit, and approve before they're saved — **AI output is never auto-saved and is not guaranteed correct, especially for numerical/calculation questions; always review before publishing a test**

- **Edit everywhere** — Questions (`Edit` link in the chapter-questions table), Test Series (`Edit Series` button on the series detail page), and a "+ Add new topic..." option on the Topic dropdown whenever the syllabus list doesn't have what you need (works even when a chapter has zero topics listed)

- **Post-Publish-Only Version History** — draft-stage edits are never tracked (unlimited free editing before a question is published); the moment a question is part of a PUBLISHED test, every subsequent edit creates a permanent, immutable version snapshot (editor, timestamp, reason). Restoring an old version creates a *new* version rather than overwriting history. View at `/admin/questions/versions/[id]`
- **Student Report Question System** — students report an issue (Wrong Answer, Typo, Wrong Solution, etc. + comment + optional screenshot) from the Bookmarks page; Super Admin, Sub Admin, the question's subject Teacher(s), and its original creator are all notified immediately. Admin Report Dashboard (`/admin/reports`) with status/priority filters, a **claim-to-edit lock** (only one teacher works a report at a time), and Resolve/Reject actions — resolving auto-notifies the reporting student

- **Auto Test-Series Code** — series codes are generated automatically as `TS-{year}-{00001}`, sequential per year — no manual entry
- **Strict Question Save-Validation** — Chapter, Topic, Sub Topic, and Solution are now mandatory on every question (client-side and server-side), along with complete statement/options/correct-answer for every enabled language
- **Sub-Topic field** — a lightweight free-text refinement below Topic, with autocomplete suggestions drawn from previously-used sub-topics for that same Topic (not a hardcoded taxonomy — see note below)
- **Question Bank Export** — download the raw question bank as CSV or Excel (Question ID, Text, Options, Section/Chapter/Topic/Sub Topic, Difficulty, Correct Answer, Solution), scoped to a subject or a single chapter
- **Per-Test Actions Menu** (⋮ on Manage Tests) — Rename, Reschedule, Change Duration, Duplicate (copies metadata + sections + questions as a fresh Draft), Archive/Unarchive, Audit Log (filtered to that test), and Delete (only for draft tests with zero attempts, to prevent destroying anything a student has touched)

- **Hindi ↔ English Answer Sync** — marking the correct answer in either language automatically marks the same option in the other (option IDs A/B/C/D are positionally identical across languages)
- **Bilingual AI Solution** — "Solve with AI" now writes the solution in both Hindi and English together (clearly separated with headers) when both languages are enabled for a question — see the note below on this being a combined single field, not two separate database fields
- **AI Hindi Translation Checker** — verifies the Hindi statement/options genuinely match the English meaning, flagging ACCURATE / PARTIALLY ACCURATE / INACCURATE with a brief reason
- **Screenshot → Auto-Fill Question** — paste (Ctrl+V) a screenshot of a question into the dedicated paste-zone at the top of the question editor, and Gemini Vision extracts the statement + options directly into the form — works for bilingual screenshots (fills both Hindi and English if both are visible) and Integer-type questions

- **Per-Language Solutions** — solution/explanation is now stored separately for Hindi and English (not one shared field), so a student viewing the question in Hindi sees the Hindi solution, and in English sees the English solution — this applies everywhere solutions appear: Question Bank, Review Mode, Post-Test Corrections, and the student Bookmarks page
- **AI Auto-Translate** — when a question has only one language filled in, one click translates the statement/options/solution into the other language using standard NCERT textbook scientific terminology (not literal/colloquial translation)
- **AI Translation Check + Auto-Fix** — when both languages are filled, checks the Hindi against the English for accuracy AND correct NCERT terminology; if it finds issues, offers a one-click "Apply AI's improved Hindi" fix
- **Solution Image Extraction** — paste/upload a photo of a written solution, and AI extracts it and writes it out in both Hindi and English
- **Careful Diagram Detection** — when extracting a question from a screenshot, the AI now explicitly separates printed text from any diagram/figure — if a diagram is present, it flags this so you know to upload that image separately rather than trying to fabricate a description of it

**Not included in this pass** (scoped down from the full spec you shared):
- Full approval-gated correction workflow (Solution/Typo/Image corrections auto-allowed vs. Correct-Option-Change/Cancellation/Bonus-Marks requiring separate Sub Admin approval) — currently any admin-tier user with test access can correct an answer key directly; there's no separate correction-approval queue
- Version history for question edits (only the Audit Log records that a change happened, not a restorable diff)
- Student-facing "Report Question" button
- Bonus marks / question cancellation as distinct actions (achievable manually today via a correction + recalculation, just not a dedicated one-click flow)
- Question tags UI (the `tags` field exists on Question in the schema, but there's no tag-input control on the question form yet)
- **Integer/Numerical exam-runtime UI** — the question editor now captures a single correct value for these types, but the student-facing exam runtime still renders them as a generic option button rather than a proper numeric input box. This needs a follow-up pass to the exam runtime to detect `type === "INTEGER" | "NUMERICAL"` and show a text/number input instead of the A/B/C/D palette.
- Match the Column / Statement Based / Assertion Reason are captured with the same 4-option structure as Single Correct (realistic for how NEET typically presents these — fixed combination options) rather than a distinct structured UI (e.g. a real drag-drop matching grid)

## 1b. Test Reminder Notifications — Vercel Cron Setup

`vercel.json` already includes a cron entry that hits `/api/cron/test-reminders` every 5 minutes once
deployed. To secure it (recommended), set a `CRON_SECRET` environment variable in Vercel — Vercel
automatically sends it as a Bearer token to your own cron routes. Locally, this endpoint has no
schedule (crons only run on Vercel); you can manually test it by visiting
`http://localhost:3000/api/cron/test-reminders` in your browser while a test's open time is within
15 minutes.

## 2c. AI-Assisted Authoring Setup

Uses the free Google Gemini API (not Anthropic) — no credit card required, no expiration, generous free
daily limits (~1,500 requests/day per key) that comfortably cover normal question-authoring usage.

1. Go to https://aistudio.google.com/apikey and click "Create API key" (sign in with any Google account).
2. Add it to `.env`:
   ```
   GEMINI_API_KEYS="AIza..."
   ```
3. Restart `npm run dev`.

**Using multiple keys (recommended for heavy use):** create a few keys — either from different Google
accounts, or multiple keys in the same account/project — and list them comma-separated:
```
GEMINI_API_KEYS="AIza...key1,AIza...key2,AIza...key3"
```
If one key hits its free-tier rate limit or daily quota, the app automatically retries with the next key
in the list — no manual switching needed.

Both AI features (Solve with AI, AI Generate) are admin-only, require at least one key, and always leave
a human review step before anything is saved — the AI drafts, you approve. Treat "high confidence" as a
starting point, not a guarantee, particularly for numerical answers. To use a different model, set
`GEMINI_MODEL` in `.env` (defaults to `gemini-flash-latest` — an alias Google keeps pointed at their
current stable Flash model, so it doesn't break every time a specific version is deprecated).

## 2d. PDF Export Setup — important notes

PDF export uses a real headless browser (Puppeteer) to render the exact same HTML/CSS/fonts/KaTeX
formulas used in the live exam, so the exported PDF matches on-screen rendering exactly.

- **Local dev**: `npm install` will download a bundled Chromium (~200–300MB) the first time — this needs
  normal internet access (not a restricted/corporate network that blocks Google's download CDN). This is
  a one-time download.
- **Vercel deploy**: automatically switches to a lightweight serverless-optimized Chromium
  (`@sparticuz/chromium`) — no extra setup needed, but keep in mind:
  - PDF generation can take several seconds for longer papers. The API route is configured for a 60s
    timeout (`maxDuration = 60`); if you're on **Vercel's Hobby (free) plan** and hit timeouts on large
    papers, you may need to upgrade to **Vercel Pro** for longer function execution time.
  - If PDF export fails only in production (works locally), check the Vercel function logs — it's almost
    always either a timeout or a memory limit on the free tier.


## 5. Architecture Notes (for later Atomic OPS merge)

- Every core table has an `externalRefId` field reserved for Atomic OPS's own IDs at merge time.
- Questions are translation-normalized (`QuestionTranslation` table, one row per language) — this is what
  makes "Hindi only / English only / Both" work without duplicating question records.
- Auth is self-contained JWT + httpOnly cookie — easy to swap for Atomic OPS's central SSO later without
  touching the data model.

## 6. What to build next (Phase 2 priorities, in order)

1. Exam Integrity Score (weighted, not just raw violation count)
2. Rich question editor (MathLive + image upload)
3. AI Coach recommendations (weak/strong topic engine)
4. NEET Rank Predictor (needs you to supply/curate previous-year score-vs-rank data)
5. Full role hierarchy + permission matrix

## DPP (Daily Practice Problems) Module — Phase 1

A lighter, chapter-scoped practice module that reuses the Test module's Question Bank, bilingual rendering, scoring, and formula/chemistry editor rather than duplicating them.

- **Student flow**: `/student/dpp` → pick subject → pick chapter → browse DPP cards (name, code, faculty, question count, time, difficulty, language, Start/Continue/Re-attempt) → practice runtime (same palette/timer/navigation UX as Tests, but untimed/count-up since it's casual practice, not a proctored exam — no fullscreen lock or violation tracking)
- **Admin flow**: `/admin/dpps` → Create DPP (auto-coded `AP0001` style) → Question Editor (same side-by-side Hindi/English authoring, AI Solve, per-language solution as the Test module) → Publish
- **Shared infrastructure reused as-is**: Question/QuestionTranslation data, the `Attempt` model (now polymorphic — works for either a Test or a DPP), scoring library, Bookmarks, RBAC

**Scoped down from the full spec for this pass** (clearly flagged, not silently skipped):
- Unified single-file (Q+A+Solution) import parsing — not built yet, a substantial new AI-parsing feature slated for a later phase
- Combined single-PDF export (Cover→Questions→AnswerKey→Solutions) — the DPP-specific cover design and the Test-module PDF overhaul are both still pending; PDF export isn't wired up for DPPs yet
- DPP analytics dashboard, search/filter beyond subject/chapter/name, and DPP-specific version history UI (question-level version history from the Test module still applies underneath, since it's the same Question records)
- Screenshot-to-autofill and AI translation-check/auto-translate (built for Test's question editor) aren't yet ported to the DPP question editor, to keep this phase's scope achievable — straightforward to add later by reusing the same APIs
- Re-attempting a DPP after already submitting it currently resumes/shows the same locked attempt rather than starting a fresh one — full re-attempt history isn't supported yet
