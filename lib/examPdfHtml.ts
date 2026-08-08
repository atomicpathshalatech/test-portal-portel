import fs from "fs";
import { renderFormulaContent } from "./formula";
import { getLogoDataUri } from "./logo";

type OptionDef = { id: string; text: string };
type TranslationDef = {
  language: string;
  statement: string;
  options: OptionDef[];
  correctOptionIds?: string[];
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
  .page { padding: 28px 32px; }
  .page + .page { page-break-before: always; }
`;

// ---------- Cover Page ----------
function buildCoverPageHtml(opts: {
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

// ---------- Question rendering (single-language) ----------
function renderOptionsHtml(
  options: OptionDef[],
  correctOptionIds: string[] | undefined,
  mode: "question" | "solution"
): string {
  // Integer/Numerical questions have no options — the answer is a value in
  // correctOptionIds[0]. Show a blank answer line for the question paper,
  // or the correct value for the solution key.
  if (options.length === 0) {
    if (mode === "solution") {
      return `<div class="option correct">
        <span class="opt-text">Correct Answer: <strong>${renderFormulaContent((correctOptionIds || [])[0] || "")}</strong></span>
      </div>`;
    }
    return `<div class="option"><span class="opt-text">Answer: _______________</span></div>`;
  }

  return options
    .map((opt) => {
      const isCorrect = mode === "solution" && (correctOptionIds || []).includes(opt.id);
      return `<div class="option${isCorrect ? " correct" : ""}">
        <span class="opt-id">${opt.id}</span>
        <span class="opt-text">${renderFormulaContent(opt.text)}</span>
        ${isCorrect ? '<span class="check">&#10003;</span>' : ""}
      </div>`;
    })
    .join("");
}

// ---------- Question rendering (bilingual two-column) ----------
function buildBilingualQuestionsHtml(sections: SectionDef[], mode: "question" | "solution"): string {
  let qNumber = 0;
  return sections
    .map((sec) => {
      const questionsHtml = sec.questions
        .map((q) => {
          qNumber++;
          const hi = q.translations.find((t) => t.language === "hi");
          const en = q.translations.find((t) => t.language === "en");
          const imageHtml = q.imageUrl
            ? `<div class="q-image-wrap"><img src="${q.imageUrl}" class="q-image" /></div>`
            : "";
          const topicTag = q.topic ? ` · ${q.topic}` : "";

          const hiCol = hi
            ? `<div class="col">
                <div class="q-header">${qNumber}. <span class="difficulty">[${q.difficulty}${topicTag}]</span></div>
                <div class="q-statement">${renderFormulaContent(hi.statement)}</div>
                <div class="options">${renderOptionsHtml(hi.options, hi.correctOptionIds, mode)}</div>
              </div>`
            : `<div class="col"></div>`;

          const enCol = en
            ? `<div class="col col-right">
                <div class="q-header">${qNumber}.</div>
                <div class="q-statement">${renderFormulaContent(en.statement)}</div>
                <div class="options">${renderOptionsHtml(en.options, en.correctOptionIds, mode)}</div>
              </div>`
            : `<div class="col col-right"></div>`;

          return `<div class="question-block">
            ${imageHtml}
            <div class="question-row">${hiCol}${enCol}</div>
          </div>`;
        })
        .join("");
      return `<h2 class="section-title">SUBJECT: ${sec.name.toUpperCase()}</h2>${questionsHtml}`;
    })
    .join("");
}

// ---------- Question rendering (single-language, one column) ----------
function buildSingleLangQuestionsHtml(
  sections: SectionDef[],
  lang: "hi" | "en",
  mode: "question" | "solution"
): string {
  let qNumber = 0;
  return sections
    .map((sec) => {
      const questionsHtml = sec.questions
        .map((q) => {
          qNumber++;
          const t = q.translations.find((tr) => tr.language === lang) || q.translations[0];
          if (!t) return "";
          const imageHtml = q.imageUrl
            ? `<img src="${q.imageUrl}" class="q-image" />`
            : "";
          const topicTag = q.topic ? ` · ${q.topic}` : "";
          return `<div class="question">
            <div class="q-header">Q${qNumber}. <span class="difficulty">[${q.difficulty}${topicTag}]</span></div>
            ${imageHtml}
            <div class="q-statement">${renderFormulaContent(t.statement)}</div>
            <div class="options">${renderOptionsHtml(t.options, t.correctOptionIds, mode)}</div>
          </div>`;
        })
        .join("");
      return `<div class="section"><h2 class="section-title">${sec.name}</h2>${questionsHtml}</div>`;
    })
    .join("");
}

export function buildExamPdfHtml(opts: {
  testName: string;
  testCode: string;
  sections: SectionDef[];
  lang: "hi" | "en";
  mode: "question" | "solution";
  correctMarks: number;
  incorrectMarks: number;
  durationMin: number;
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  includeCoverPage: boolean;
}): string {
  const {
    testName, testCode, sections, lang, mode,
    correctMarks, incorrectMarks, durationMin, languageMode, includeCoverPage,
  } = opts;
  const katexCss = getKatexCss();
  const isBilingual = languageMode === "BOTH";
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  const coverHtml = includeCoverPage
    ? buildCoverPageHtml({ testName, testCode, durationMin, correctMarks, incorrectMarks, totalQuestions, languageMode })
    : "";

  const bodyHtml = isBilingual
    ? buildBilingualQuestionsHtml(sections, mode)
    : buildSingleLangQuestionsHtml(sections, lang, mode);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap">
<style>${katexCss}</style>
<style>
  ${BASE_STYLES}

  /* Watermark — fixed positioning repeats on every printed page in Chromium's PDF renderer */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
  }
  .watermark img { width: 320px; height: 320px; }
  .page, .cover-page { position: relative; z-index: 1; }

  /* Cover page */
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
  .candidate-table .fill { }
  .signature-row { display:flex; justify-content:space-between; margin-top:40px; font-size:11px; color:#334155; }

  /* Question paper */
  .section-title { font-size: 14px; color: #1E4FD8; border-bottom: 1px solid #e2e8f0; padding: 16px 0 4px; margin: 0; }
  .section { }
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
</style>
</head>
<body>
  <div class="watermark"><img src="${getLogoDataUri()}" /></div>
  ${coverHtml}
  <div class="page">
    ${bodyHtml}
  </div>
</body>
</html>`;
}
