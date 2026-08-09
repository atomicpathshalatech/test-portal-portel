import fs from "fs";
import { renderFormulaContent } from "./formula";
import { getLogoDataUri } from "./logo";

type OptionDef = { id: string; text: string };
type TranslationDef = {
  language: string;
  statement: string;
  options: OptionDef[];
  correctOptionIds?: string[];
  solution?: string | null;
};
type QuestionDef = {
  topic?: string | null;
  difficulty: string;
  imageUrl?: string | null;
  translations: TranslationDef[];
};
type SectionDef = { name: string; questions: QuestionDef[] };

function getKatexCss(): string {
  try {
    const p = require.resolve("katex/dist/katex.min.css");
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', 'Noto Sans Devanagari', sans-serif;
    color: #1e293b;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .page { padding: 28px 32px; position: relative; z-index: 1; }
  .page + .page { page-break-before: always; }
`;

// ---------- Test Cover Page (NTA-booklet style) ----------
function buildTestCoverPageHtml(opts: {
  testName: string;
  testCode: string;
  durationMin: number;
  correctMarks: number;
  incorrectMarks: number;
  totalQuestions: number;
  languageMode: string;
}): string {
  const { testName, testCode, durationMin, correctMarks, incorrectMarks, totalQuestions, languageMode } = opts;
  const langLabel =
    languageMode === "BOTH" ? "Hindi + English" : languageMode === "HINDI" ? "हिंदी" : "English";

  return `
  <div class="page cover-page">
    <div class="cover-top">
      <div class="brand"><img src="${getLogoDataUri()}" class="brand-logo" /> Atomic Pathshala</div>
      <div class="cover-meta-box">
        <div><strong>Test Pattern:</strong> ${testName}</div>
        <div><strong>Language:</strong> ${langLabel}</div>
      </div>
    </div>

    <div class="cover-code-row">
      <div class="code-box">
        <div class="code-label">Test Booklet Code</div>
        <div class="code-value">${testCode}</div>
      </div>
      <div class="cover-instruction-note">
        <p>Do not open this Test Booklet until you are asked to do so.</p>
        <p>Read the instructions below carefully before you begin.</p>
      </div>
    </div>

    <div class="cover-instructions">
      <div class="instructions-col">
        <h3>महत्वपूर्ण निर्देश</h3>
        <ol>
          <li>यह पुस्तिका खोलने के लिए कहे जाने पर ही खोलें।</li>
          <li>परीक्षा की अवधि ${durationMin} मिनट है और इसमें कुल ${totalQuestions} प्रश्न हैं।</li>
          <li>प्रत्येक सही उत्तर के लिए +${correctMarks} अंक और प्रत्येक गलत उत्तर के लिए ${incorrectMarks} अंक दिए जाएंगे।</li>
          <li>केवल नीले/काले बॉल पॉइंट पेन का प्रयोग करें।</li>
          <li>रफ कार्य केवल निर्धारित स्थान पर ही करें।</li>
        </ol>
      </div>
      <div class="instructions-col">
        <h3>Important Instructions</h3>
        <ol>
          <li>Do not open this booklet until instructed to do so.</li>
          <li>The test duration is ${durationMin} minutes and contains ${totalQuestions} questions in total.</li>
          <li>Each correct answer carries +${correctMarks} marks; each incorrect answer carries ${incorrectMarks} marks.</li>
          <li>Use only a blue/black ball point pen.</li>
          <li>Rough work should be done only in the space provided.</li>
        </ol>
      </div>
    </div>

    <div class="ambiguity-note">
      In case of any ambiguity in translation of any question, the English version shall be treated as final.
      किसी भी प्रश्न के अनुवाद में अस्पष्टता की स्थिति में, अंग्रेजी संस्करण को ही अंतिम माना जाएगा।
    </div>

    <table class="candidate-table">
      <tr><td class="label">Name of the Candidate (in Capitals):</td><td class="fill"></td></tr>
      <tr><td class="label">Form / Roll Number:</td><td class="fill"></td></tr>
      <tr><td class="label">Centre of Examination:</td><td class="fill"></td></tr>
    </table>

    <div class="signature-row">
      <div>Candidate's Signature: ______________________</div>
      <div>Invigilator's Signature: ______________________</div>
    </div>
  </div>`;
}

// ---------- DPP Cover Page (dedicated design, per spec) ----------
export function buildDppCoverPageHtml(opts: {
  dppName: string;
  dppCode: string;
  subject: string;
  facultyName?: string | null;
  levelNumber?: number | null;
  levelName?: string | null;
  batchLabel?: string;
  telegramUrl?: string;
  websiteUrl?: string;
}): string {
  const {
    dppName, dppCode, subject, facultyName, levelNumber, levelName,
    batchLabel = "SELECTION PRO DROPPER BATCH · NEET 2027",
    telegramUrl = "https://t.me/Atomicpathshala",
    websiteUrl = "www.atomicpathshala.in",
  } = opts;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(telegramUrl)}`;

  return `
  <div class="page dpp-cover-page">
    <div class="dpp-cover-header">
      <img src="${getLogoDataUri()}" class="dpp-cover-logo-sm" />
      <div class="dpp-cover-brand">ATOMIC PATHSHALA</div>
      <div class="dpp-cover-tagline">LEARN &bull; EXPLORE &bull; EXCEL</div>
    </div>

    <div class="dpp-cover-title-band">DAILY PRACTICE PROBLEMS (DPP)</div>

    ${levelNumber ? `<div class="dpp-cover-level-band">LEVEL ${levelNumber}${levelName ? ` — ${levelName}` : ""}</div>` : ""}

    <table class="dpp-cover-meta">
      <tr><td class="dpp-meta-label">DPP Name</td><td class="dpp-meta-value">${dppName}</td></tr>
      <tr><td class="dpp-meta-label">DPP Code</td><td class="dpp-meta-value">${dppCode}</td></tr>
      <tr><td class="dpp-meta-label">Subject</td><td class="dpp-meta-value">${subject}</td></tr>
      ${facultyName ? `<tr><td class="dpp-meta-label">Faculty</td><td class="dpp-meta-value">${facultyName}</td></tr>` : ""}
    </table>

    <div class="dpp-cover-batch-band">${batchLabel}</div>

    <div class="dpp-cover-logo-large-wrap">
      <img src="${getLogoDataUri()}" class="dpp-cover-logo-lg" />
    </div>

    <div class="dpp-cover-telegram">
      <div class="dpp-telegram-title">Join Atomic Pathshala Official Telegram</div>
      <img src="${qrUrl}" class="dpp-qr" />
      <a href="${telegramUrl}" class="dpp-telegram-link">${telegramUrl}</a>
    </div>

    <div class="dpp-cover-footer">
      <a href="https://${websiteUrl.replace(/^https?:\/\//, "")}">🌐 ${websiteUrl}</a>
    </div>
  </div>`;
}

// ---------- Options rendering ----------
// mode "blank" = question paper (no answers shown, ever)
// mode "keyed" = highlight the correct option (used only inside the Solutions section)
function renderOptionsHtml(options: OptionDef[], correctOptionIds: string[] | undefined, mode: "blank" | "keyed"): string {
  if (options.length === 0) {
    if (mode === "keyed") {
      return `<div class="option correct">
        <span class="opt-text">Correct Answer: <strong>${renderFormulaContent((correctOptionIds || [])[0] || "")}</strong></span>
      </div>`;
    }
    return `<div class="option"><span class="opt-text">Answer: _______________</span></div>`;
  }

  return options
    .map((opt) => {
      const isCorrect = mode === "keyed" && (correctOptionIds || []).includes(opt.id);
      return `<div class="option${isCorrect ? " correct" : ""}">
        <span class="opt-id">${opt.id}</span>
        <span class="opt-text">${renderFormulaContent(opt.text)}</span>
        ${isCorrect ? '<span class="check">&#10003;</span>' : ""}
      </div>`;
    })
    .join("");
}

// ---------- Question paper (bilingual two-column) — always blank, never shows answers ----------
function buildBilingualQuestionsHtml(sections: SectionDef[]): string {
  let qNumber = 0;
  return sections
    .map((sec) => {
      const questionsHtml = sec.questions
        .map((q) => {
          qNumber++;
          const hi = q.translations.find((t) => t.language === "hi");
          const en = q.translations.find((t) => t.language === "en");
          const imageHtml = q.imageUrl ? `<div class="q-image-wrap"><img src="${q.imageUrl}" class="q-image" /></div>` : "";

          const hiCol = hi
            ? `<div class="col">
                <div class="q-header">${qNumber}.</div>
                <div class="q-statement">${renderFormulaContent(hi.statement)}</div>
                <div class="options">${renderOptionsHtml(hi.options, hi.correctOptionIds, "blank")}</div>
              </div>`
            : `<div class="col"></div>`;

          const enCol = en
            ? `<div class="col col-right">
                <div class="q-header">${qNumber}.</div>
                <div class="q-statement">${renderFormulaContent(en.statement)}</div>
                <div class="options">${renderOptionsHtml(en.options, en.correctOptionIds, "blank")}</div>
              </div>`
            : `<div class="col col-right"></div>`;

          return `<div class="question-block">${imageHtml}<div class="question-row">${hiCol}${enCol}</div></div>`;
        })
        .join("");
      return `<h2 class="section-title">SUBJECT: ${sec.name.toUpperCase()}</h2>${questionsHtml}`;
    })
    .join("");
}

function buildSingleLangQuestionsHtml(sections: SectionDef[], lang: "hi" | "en"): string {
  let qNumber = 0;
  return sections
    .map((sec) => {
      const questionsHtml = sec.questions
        .map((q) => {
          qNumber++;
          const t = q.translations.find((tr) => tr.language === lang) || q.translations[0];
          if (!t) return "";
          const imageHtml = q.imageUrl ? `<img src="${q.imageUrl}" class="q-image" />` : "";
          return `<div class="question">
            <div class="q-header">Q${qNumber}.</div>
            ${imageHtml}
            <div class="q-statement">${renderFormulaContent(t.statement)}</div>
            <div class="options">${renderOptionsHtml(t.options, t.correctOptionIds, "blank")}</div>
          </div>`;
        })
        .join("");
      return `<div class="section"><h2 class="section-title">${sec.name}</h2>${questionsHtml}</div>`;
    })
    .join("");
}

// ---------- Answer Key page (grid table) ----------
function buildAnswerKeyHtml(sections: SectionDef[], lang: "hi" | "en"): string {
  const rows: { num: number; answer: string }[] = [];
  let qNumber = 0;
  for (const sec of sections) {
    for (const q of sec.questions) {
      qNumber++;
      const t = q.translations.find((tr) => tr.language === lang) || q.translations[0];
      const ids = (t?.correctOptionIds as string[]) || [];
      rows.push({ num: qNumber, answer: ids.join(", ") || "—" });
    }
  }
  const cells = rows
    .map((r) => `<div class="ak-cell"><span class="ak-num">${r.num}</span><span class="ak-ans">${r.answer}</span></div>`)
    .join("");
  return `
    <h2 class="answer-key-title">ANSWER KEY</h2>
    <div class="answer-key-grid">${cells}</div>
  `;
}

// ---------- Solutions section — real explanation text, per language ----------
function buildSolutionsHtml(sections: SectionDef[], languageMode: string, lang: "hi" | "en"): string {
  const isBilingual = languageMode === "BOTH";
  let qNumber = 0;
  const blocks = sections.flatMap((sec) =>
    sec.questions.map((q) => {
      qNumber++;
      if (isBilingual) {
        const hi = q.translations.find((t) => t.language === "hi");
        const en = q.translations.find((t) => t.language === "en");
        const hiAnswerLine =
          (hi?.options.length || 0) > 0
            ? `Correct Option: <strong>${(hi?.correctOptionIds || []).join(", ")}</strong>`
            : `Correct Answer: <strong>${(hi?.correctOptionIds || [])[0] || ""}</strong>`;
        const enAnswerLine =
          (en?.options.length || 0) > 0
            ? `Correct Option: <strong>${(en?.correctOptionIds || []).join(", ")}</strong>`
            : `Correct Answer: <strong>${(en?.correctOptionIds || [])[0] || ""}</strong>`;
        const hiCol = hi
          ? `<div class="sol-col">
              <div class="sol-header">${qNumber}. ${hiAnswerLine}</div>
              ${hi.solution ? `<div class="sol-text">${renderFormulaContent(hi.solution)}</div>` : `<div class="sol-text sol-missing">इस प्रश्न का समाधान अभी जोड़ा नहीं गया है।</div>`}
            </div>`
          : `<div class="sol-col"></div>`;
        const enCol = en
          ? `<div class="sol-col sol-col-right">
              <div class="sol-header">${qNumber}. ${enAnswerLine}</div>
              ${en.solution ? `<div class="sol-text">${renderFormulaContent(en.solution)}</div>` : `<div class="sol-text sol-missing">No written solution added for this question yet.</div>`}
            </div>`
          : `<div class="sol-col sol-col-right"></div>`;
        return `<div class="solution-block solution-row">${hiCol}${enCol}</div>`;
      }
      const t = q.translations.find((tr) => tr.language === lang) || q.translations[0];
      const answerLine =
        (t?.options.length || 0) > 0
          ? `Correct Option: <strong>${(t?.correctOptionIds || []).join(", ")}</strong>`
          : `Correct Answer: <strong>${(t?.correctOptionIds || [])[0] || ""}</strong>`;
      return `<div class="solution-block">
        <div class="sol-header">${qNumber}. ${answerLine}</div>
        ${t?.solution ? `<div class="sol-text">${renderFormulaContent(t.solution)}</div>` : `<div class="sol-text sol-missing">No written solution added for this question yet.</div>`}
      </div>`;
    })
  );
  return `<h2 class="answer-key-title solutions-title">SOLUTIONS</h2>${blocks.join("")}`;
}

const SHARED_STYLES = `
  /* Watermark — fixed positioning repeats on every printed page in Chromium's PDF renderer */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(0deg);
    opacity: 0.05; z-index: 0; pointer-events: none;
  }
  .watermark img { width: 320px; height: 320px; }

  /* Test cover page */
  .cover-top { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1E4FD8; padding-bottom:10px; }
  .brand { font-size: 18px; font-weight:700; color:#13327F; display:flex; align-items:center; gap:8px; }
  .brand-logo { width: 28px; height: 28px; }
  .cover-meta-box { text-align:right; font-size:12px; color:#334155; }
  .cover-code-row { display:flex; gap:16px; margin-top:16px; align-items:flex-start; }
  .code-box { border:2px solid #1E4FD8; border-radius:6px; padding:10px 18px; text-align:center; }
  .code-label { font-size:10px; color:#64748b; }
  .code-value { font-size:20px; font-weight:700; color:#13327F; letter-spacing:1px; }
  .cover-instruction-note { font-size:11px; color:#475569; padding-top:6px; }
  .cover-instructions { display:flex; gap:24px; margin-top:20px; }
  .instructions-col { flex:1; }
  .instructions-col h3 { font-size:13px; color:#1E4FD8; margin:0 0 6px; }
  .instructions-col ol { margin:0; padding-left:18px; font-size:11px; color:#334155; }
  .instructions-col li { margin-bottom:4px; }
  .ambiguity-note { margin-top:16px; padding:8px 12px; background:#eaf0ff; border-radius:6px; font-size:10.5px; color:#334155; text-align:center; }
  .candidate-table { width:100%; margin-top:20px; border-collapse: collapse; }
  .candidate-table td { padding:10px 4px; border-bottom:1px solid #e2e8f0; font-size:12px; }
  .candidate-table .label { width:220px; color:#334155; }
  .signature-row { display:flex; justify-content:space-between; margin-top:40px; font-size:11px; color:#334155; }

  /* DPP cover page — dedicated design, distinct from Test */
  .dpp-cover-page { display:flex; flex-direction:column; align-items:center; text-align:center; padding-top: 40px; }
  .dpp-cover-header { display:flex; flex-direction:column; align-items:center; padding-bottom:18px; border-bottom:2px solid #9D4400; width:100%; }
  .dpp-cover-logo-sm { width:56px; height:56px; margin-bottom:10px; }
  .dpp-cover-brand { font-size:34px; font-weight:800; color:#663200; letter-spacing:1.5px; }
  .dpp-cover-tagline { font-size:14px; color:#9D4400; letter-spacing:3px; margin-top:4px; font-weight:600; }
  .dpp-cover-title-band { margin-top:22px; font-size:20px; font-weight:700; color:#663200; background:#FFF3E8; padding:12px 28px; border-radius:8px; }
  .dpp-cover-level-band { margin-top:14px; font-size:15px; font-weight:700; color:#ffffff; background:#9D4400; padding:8px 20px; border-radius:20px; max-width:80%; }
  .dpp-cover-meta { margin-top:26px; width:82%; border-collapse:collapse; }
  .dpp-cover-meta td { padding:9px 10px; font-size:16px; text-align:left; border-bottom:1px solid #f1e4d8; }
  .dpp-meta-label { width:140px; color:#9D4400; font-weight:700; }
  .dpp-meta-value { color:#1e293b; font-weight:600; }
  .dpp-cover-batch-band { margin-top:26px; font-size:18px; font-weight:800; color:#663200; letter-spacing:1.5px; }
  .dpp-cover-logo-large-wrap { margin-top: 24px; }
  .dpp-cover-logo-lg { width:130px; height:130px; opacity:0.92; }
  .dpp-cover-telegram { margin-top:24px; padding:18px; background:#FFF9F3; border-radius:10px; width:72%; }
  .dpp-telegram-title { font-size:14px; font-weight:700; color:#663200; margin-bottom:10px; }
  .dpp-qr { width:120px; height:120px; }
  .dpp-telegram-link { display:block; margin-top:10px; font-size:12px; color:#2563EB; font-weight:600; }
  .dpp-cover-footer { margin-top:24px; font-size:14px; }
  .dpp-cover-footer a { color:#2563EB; text-decoration:none; font-weight:600; }

  /* Question paper */
  .section-title { font-size: 14px; color: #1E4FD8; border-bottom: 1px solid #e2e8f0; padding: 16px 0 4px; margin: 0; }
  .question { margin: 14px 0; page-break-inside: avoid; }
  .question-block { margin: 10px 0; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
  .question-row { display:flex; gap: 18px; }
  .col { flex: 1; min-width: 0; }
  .col-right { border-left: 1px solid #e2e8f0; padding-left: 18px; }
  .q-header { font-weight: 600; margin-bottom: 4px; font-size: 12px; }
  .difficulty { font-weight: 400; font-size: 10.5px; color: #94a3b8; }
  .q-statement { margin-bottom: 6px; word-wrap: break-word; }
  .q-image-wrap { text-align:center; margin: 4px 0; }
  .q-image { max-height: 140px; }
  .options { margin-left: 4px; }
  .option { display: flex; align-items: flex-start; gap: 6px; padding: 2px 0; font-size: 11.5px; }
  .option.correct { color: #16a34a; font-weight: 600; }
  .opt-id { width: 16px; height: 16px; border-radius: 50%; background:#f1f5f9; display:inline-flex; align-items:center; justify-content:center; font-size: 9.5px; flex-shrink:0; margin-top:1px; }
  .option.correct .opt-id { background:#16a34a; color:white; }
  .check { color: #16a34a; }

  /* Answer key */
  .answer-key-title { font-size: 16px; color: #1E4FD8; text-align:center; margin: 0 0 20px; }
  .solutions-title { margin-top: 28px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
  .answer-key-grid { display:grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
  .ak-cell { border:1px solid #e2e8f0; border-radius:4px; padding:6px; text-align:center; font-size: 11px; }
  .ak-num { display:block; color:#94a3b8; font-size:9.5px; }
  .ak-ans { display:block; font-weight:700; color:#13327F; margin-top:2px; }

  /* Solutions */
  .solution-block { margin: 0 0 18px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
  .solution-row { display: flex; gap: 18px; }
  .sol-col { flex: 1; min-width: 0; }
  .sol-col-right { border-left: 1px solid #e2e8f0; padding-left: 18px; }
  .sol-header { font-weight:700; font-size:12.5px; color:#13327F; margin-bottom:6px; }
  .sol-lang-label { font-size:10px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-top:8px; }
  .sol-text { font-size:11.5px; color:#334155; margin-top:4px; }
  .sol-missing { color:#94a3b8; font-style:italic; }
`;

function wrapHtmlDocument(bodyHtml: string, lang: string): string {
  const katexCss = getKatexCss();
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap">
<style>${katexCss}</style>
<style>${BASE_STYLES}${SHARED_STYLES}</style>
</head>
<body>
  <div class="watermark"><img src="${getLogoDataUri()}" /></div>
  ${bodyHtml}
</body>
</html>`;
}

// ---------- Combined document builder — Cover → Questions → [Answer Key → Solutions] ----------
// This replaces the old separate "Question PDF" / "Solution PDF" pair with
// ONE PDF, per the export-overhaul spec. `withSolutions` controls whether
// the Answer Key + Solutions sections are appended.
export function buildCombinedPdfHtml(opts: {
  coverHtml: string;
  sections: SectionDef[];
  lang: "hi" | "en";
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  withSolutions: boolean;
}): string {
  const { coverHtml, sections, lang, languageMode, withSolutions } = opts;
  const isBilingual = languageMode === "BOTH";

  const questionsBodyHtml = isBilingual ? buildBilingualQuestionsHtml(sections) : buildSingleLangQuestionsHtml(sections, lang);
  const questionsPageHtml = `<div class="page">${questionsBodyHtml}</div>`;

  const answerAndSolutionsHtml = withSolutions
    ? `<div class="page">${buildAnswerKeyHtml(sections, lang)}${buildSolutionsHtml(sections, languageMode, lang)}</div>`
    : "";

  return wrapHtmlDocument(`${coverHtml}${questionsPageHtml}${answerAndSolutionsHtml}`, lang);
}

// Kept for the Test module's cover — call buildCombinedPdfHtml with this as coverHtml.
export function buildTestCover(opts: {
  testName: string;
  testCode: string;
  durationMin: number;
  correctMarks: number;
  incorrectMarks: number;
  totalQuestions: number;
  languageMode: string;
}): string {
  return buildTestCoverPageHtml(opts);
}

// ---------- PDF page footer (Puppeteer's own header/footer mechanism) ----------
// This is a SEPARATE HTML snippet rendered by Chromium's print engine — it
// is NOT part of the page's own HTML/CSS, so styles must be inline and
// external stylesheets don't apply. Chromium auto-populates the special
// classes "pageNumber" and "totalPages". Real <a href> tags remain
// clickable in the exported PDF.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=co.penny.nqznd&pcampaignid=web_share";
const WEBSITE_URL = "https://www.atomicpathshala.in";

export function buildPdfFooterTemplate(): string {
  return `
  <div style="width:100%; font-family:Arial,sans-serif; font-size:9px; color:#64748b; display:flex; align-items:center; justify-content:space-between; padding:0 28px; -webkit-print-color-adjust:exact;">
    <a href="${PLAY_STORE_URL}" style="color:#2563EB; text-decoration:none; font-weight:600;">📥 Click here to download app</a>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    <a href="${WEBSITE_URL}" style="color:#2563EB; text-decoration:none; font-weight:600;">🌐 www.atomicpathshala.in</a>
  </div>`;
}

export function buildPdfHeaderTemplate(): string {
  // Empty on purpose — we don't want a header, only the footer, but
  // Puppeteer requires both to be provided when displayHeaderFooter is true.
  return `<div></div>`;
}
