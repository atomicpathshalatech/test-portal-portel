// Local dev (Windows/Mac/Linux): uses the full "puppeteer" package, which
// manages its own bundled Chromium download automatically — works out of
// the box everywhere, no extra setup needed. If PUPPETEER_EXECUTABLE_PATH
// is set (e.g. pointing at a local Chrome install), that's used instead —
// useful when the bundled Chromium download fails/is blocked.
//
// On Vercel: the full Chromium binary is too large for serverless
// functions, so we switch to "puppeteer-core" + "@sparticuz/chromium",
// which is a serverless-optimized build.

export async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}
