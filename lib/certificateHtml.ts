import { getLogoDataUri } from "./logo";

export function buildCertificateHtml(opts: {
  studentName: string;
  testName: string;
  score: number | null;
  rank: number | null;
  totalStudents: number;
  date: Date;
}): string {
  const { studentName, testName, score, rank, totalStudents, date } = opts;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Hanken Grotesk', sans-serif;
    margin: 0;
    padding: 60px;
    background: #FFF8F2;
  }
  .frame {
    border: 3px solid #9D4400;
    border-radius: 16px;
    padding: 60px 70px;
    text-align: center;
    background: white;
    position: relative;
  }
  .frame::before {
    content: "";
    position: absolute;
    inset: 12px;
    border: 1px solid #FFD9B8;
    border-radius: 10px;
    pointer-events: none;
  }
  .brand { font-size: 22px; font-weight: 800; color: #9D4400; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .brand img { width: 32px; height: 32px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg); opacity: 0.06; z-index: 0; pointer-events: none; }
  .watermark img { width: 380px; height: 380px; }
  .frame { position: relative; z-index: 1; }
  .subtitle { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 40px; }
  .title { font-size: 16px; color: #64748b; margin-bottom: 6px; }
  .name { font-size: 40px; font-weight: 800; color: #191C1D; margin: 10px 0 30px; border-bottom: 2px solid #FFD9B8; display: inline-block; padding-bottom: 10px; }
  .body-text { font-size: 15px; color: #475569; line-height: 1.7; max-width: 560px; margin: 0 auto 30px; }
  .test-name { font-weight: 700; color: #9D4400; }
  .stats { display: flex; justify-content: center; gap: 60px; margin: 30px 0 40px; }
  .stat-value { font-size: 28px; font-weight: 800; color: #191C1D; }
  .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; }
  .date { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #94a3b8; }
  .seal { width: 70px; height: 70px; border-radius: 50%; background: white; border: 2px solid #9D4400; display: flex; align-items: center; justify-content: center; padding: 8px; }
  .seal img { width: 100%; height: 100%; object-fit: contain; }
</style>
</head>
<body>
  <div class="watermark"><img src="${getLogoDataUri()}" /></div>
  <div class="frame">
    <div class="brand"><img src="${getLogoDataUri()}" /> ATOMIC PATHSHALA</div>
    <div class="subtitle">Certificate of Completion</div>

    <div class="title">This is to certify that</div>
    <div class="name">${studentName}</div>

    <div class="body-text">
      has successfully completed <span class="test-name">${testName}</span>
      and demonstrated their preparation with dedication and integrity.
    </div>

    <div class="stats">
      <div>
        <div class="stat-value">${score ?? "—"}</div>
        <div class="stat-label">Score</div>
      </div>
      <div>
        <div class="stat-value">${rank ? `#${rank}` : "—"}</div>
        <div class="stat-label">Rank ${totalStudents ? `of ${totalStudents}` : ""}</div>
      </div>
    </div>

    <div class="footer">
      <div class="date">Issued on ${date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
      <div class="seal"><img src="${getLogoDataUri()}" /></div>
    </div>
  </div>
</body>
</html>`;
}
