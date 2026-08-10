# Module Studio — Phases 1, 2, 3, 4, 6 + Branding (§19-25) + Review gate (§29-30)

This patch adds the Module Studio data model, upload flow (Phases 1–2), and
PDF analysis/page rendering (Phase 3) to atomic-test-portal. It was written
and reviewed against your actual schema/conventions, but could not be
`npm install`'d, migrated, or build-checked in the sandbox that produced it
(no network/DB access there). Run these steps in your real dev environment
before using it:

1. Copy the changed/new files from this patch into your project (see the
   file list in the chat response — this isn't a full repo, just the delta).
2. `npm install` — pulls in `pdf-lib`, `pdfjs-dist`, and `@napi-rs/canvas`
   (newly added to package.json). `@napi-rs/canvas` ships prebuilt native
   binaries for common platforms, matching your existing Vercel target — no
   native build toolchain needed, unlike `node-canvas`.
3. In Supabase, create three **private** storage buckets:
   `module-originals`, `module-assets`, `module-exports`
   (`module-originals` and `module-assets` are used by this patch;
   `module-exports` is for the export phase below).
4. `npx prisma migrate dev --name add_module_studio`
5. `npx prisma generate`
6. `npm run build` — confirm no type errors before deploying.

## What this patch actually does

**Phase 1–2 (upload):**
- Upload a PDF at `/admin/module-studio/upload` (title + metadata + a rights
  confirmation checkbox, per spec §46)
- Validates it's a real PDF, reads its real page count and page dimensions
  via `pdf-lib`, stores the original file in Supabase Storage untouched
  (spec §35 — original is never overwritten)
- Creates a `Module` row, one `ModulePage` row per real page, and an
  initial `ModuleVersion` snapshot

**Phase 3 (analysis + rendering):**
- "Run Analysis" button on the module detail page, calling a real API route
- Each page is classified DIGITAL / SCANNED / HYBRID using `pdfjs-dist`'s
  text-content and operator-list APIs (a page with text runs = digital, no
  text = scanned, both text and embedded images = hybrid) — spec §5
- Each page is rendered to a PNG reference image at 2x scale via
  `pdfjs-dist` + `@napi-rs/canvas`, uploaded to the `module-assets` bucket
  — this is the "Original Reference Layer" the spec's hybrid architecture
  (§7) calls for; the editable element layer (Phase 6) will sit on top of it
- Progress and failures are tracked on a real `ProcessingJob` row
- Reference images are served through short-lived signed URLs (both storage
  buckets are private) via `/api/module-studio/[id]/file`
- Module detail page shows a live thumbnail grid once analysis completes

**Important execution-model caveat (read this before testing with a real
module):** the analyze route runs the entire per-page render loop inside a
single request. That's fine for small modules (roughly 20-30 pages) within
Vercel's default function timeout. For the 100–200+ page modules the spec
requires (§38, §41), this needs to become a real background job — a queue
(Inngest, QStash) or a worker polling the `ProcessingJob` table — before
it's production-ready at that scale. I structured the progress-tracking
fields so that migration doesn't require another schema change, only a
different execution trigger.

**Phase 4 (content extraction):**
- "Extract Content" button on the module detail page (appears after analysis)
- Text: `pdfjs-dist` text items are grouped into lines (by baseline proximity)
  then blocks (by vertical gap), classified into QUESTION/OPTION/SOLUTION by
  regex pattern (e.g. `Q1.`, `(A)`, `Solution:`) or HEADING by font-size
  relative to the page's median — all heuristic, all labeled `confidence:
  "HEURISTIC"` in the stored element data
- Images: bounding boxes are computed by walking the operator list's
  save/restore/transform ops to track the CTM at each `paintImageXObject`
  call (standard PDF unit-square convention), then **cropped directly from
  the Phase 3 reference PNG** rather than extracting raw embedded image
  streams — this sidesteps the many ways raw stream extraction breaks
  (CMYK, JPX, inline masks) at the cost of not getting the original
  uncompressed asset. Cropped images get `confidence: "HIGH"` since the crop
  is pixel-exact against the render
- Every page with any extraction is marked `needsReview` and carries
  specific `warnings` (heuristic grouping, OCR not implemented, partial
  image extraction) — nothing is silently presented as certain, per spec §29
- Module detail page shows extracted element counts per page and a REVIEW
  badge on flagged pages

**Phase 6 (visual canvas editor — first slice):**
- Click any page thumbnail to open `/admin/module-studio/[id]/[pageNumber]`
- Real drag-to-move, corner-handle resize, double-click-to-edit text, and
  delete — every one of these calls `PATCH /api/module-studio/[id]/pages/
  [pageNumber]` and persists to `ModulePage.elements`, not just local state
  (per spec §11's explicit ban on fake editors)
- Extracted images render via signed URLs against the cropped assets from
  Phase 4; a manual edit clears the page's `needsReview` flag, since editing
  is how a reviewed page gets confirmed
- Save state shown (Saving… / Saved ✓ / Save failed) so silent data loss
  is visible instead of hidden

**Not in this editor slice** (real gaps, not stylistic omissions):
- No rotate, no multi-select, no snap-to-grid/alignment guides, no rulers
- No keyboard shortcuts (spec §51)
- No undo/redo (spec §37) — the PATCH endpoint does a full-array replace,
  which is the wrong foundation for undo; that needs an operation log
- No autosave/recovery on crash (spec §36) — saves only happen on
  drag-end/blur, and there's no draft-recovery if the tab closes mid-edit
- Adding new elements (text/shape/table) isn't built — only editing what
  extraction already produced
- No layer reordering (bring forward/send back)

**Branding (header/footer/watermark, spec §19-25):**
- `/admin/module-studio/brand-settings` — create/edit reusable `BrandProfile`s:
  header (brand name, tagline, subject/class toggle), footer (left/center/
  right text, page number toggle), watermark (text, opacity)
- On a module's detail page, a Branding panel picks a profile and applies
  it — this generates real `HEADER`/`FOOTER`/`WATERMARK` elements on every
  page (margins, not overlapping content) and marks them `locked: true`
- Locked elements render with an amber outline and label in the page
  editor and can't be dragged — they're meant to be managed by re-applying
  the brand profile, not hand-edited per page (no per-page override yet —
  see gaps below)
- Re-applying is idempotent: old branding elements are stripped by type
  before the new set is added, so it never duplicates

**Review gate (spec §29-30) — this was the specific ask, "review option before export":**
- `/admin/module-studio/[id]/review` — shows pages-ready count, whether
  branding is applied, and lists every page still flagged with its specific
  warning
- "Mark as Reviewed" is blocked while any page needs review; "Mark Reviewed
  Anyway" is available as an explicit override, never silent
- Marking reviewed sets `Module.reviewedById`/`reviewedAt` (who/when,
  independent of status) and `Module.status = READY`, and logs a
  `ModuleVersion` snapshot
- **This gates status, not an actual export** — there is no export engine
  yet (see below), so "ready to export" currently means "ready for when
  export exists," not "produces a PDF now"

## What it does NOT do yet (spec phases 7 (front page), 9-12, plus real OCR)

- No OCR for scanned pages — needs an OCR engine (Tesseract.js runs
  without an external paid API, but is a real integration, not a config
  flag); scanned pages currently get zero elements and an `OCR_NOT_
  IMPLEMENTED` warning rather than silently appearing empty-but-fine
- No table detection — tables currently extract as scattered text blocks,
  not structured rows/columns (spec §17's fallback — treat as an image if
  undetectable — isn't implemented either; this is a real gap)
- No equation/chemical-notation-aware extraction — equations extract as
  plain text blocks like anything else, with no LaTeX structure (spec §14)
- No visual page canvas editor beyond the Phase 6 slice — no front-page
  generator, no layer reordering or shape/table insertion
- No per-page branding override (disable header on one page, etc.) —
  branding is all-pages-or-none per the current apply action
- No logo image in the header/watermark yet — text only; `BrandProfile.
  logoUrl` exists in the schema but isn't rendered as an element
- No PDF export of the edited module (though `lib/pdfBrowser.ts` +
  Puppeteer, already in this repo for DPP/test PDF export, is a reasonable
  base to extend for this)
- No visual regression testing, autosave, or undo/redo

