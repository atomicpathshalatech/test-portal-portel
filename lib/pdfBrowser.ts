// Local dev (Windows/Mac/Linux): uses the full "puppeteer" package, which
// manages its own bundled Chromium download automatically — works out of
// the box everywhere, no extra setup needed. If PUPPETEER_EXECUTABLE_PATH
// is set (e.g. pointing at a local Chrome install), that's used instead —
// useful when the bundled Chromium download fails/is blocked.
//
// On Vercel: the full Chromium binary is too large for serverless
// functions, so we switch to "puppeteer-core" + "@sparticuz/chromium",
// which is a serverless-optimized build.
//
// IMPORTANT — this also requires an env var set in the Vercel project
// dashboard (Settings > Environment Variables), NOT just in code:
//   AWS_LAMBDA_JS_RUNTIME = nodejs20.x   (or nodejs22.x — match your
//   project's actual Node.js version under Settings > General)
// @sparticuz/chromium reads this the moment the module is imported, before
// any of our code runs, to decide which Chromium binary variant to
// extract. Setting it inside this file is too late — it has to be present
// in the environment before the Lambda cold-starts.

export async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    // Disabling graphics mode avoids a class of missing-shared-library
    // crashes (libnss3.so among them) on serverless runtimes that don't
    // have a GPU/graphics stack — Chromium doesn't need one for headless
    // PDF/screenshot rendering anyway.
    if (typeof (chromium as any).setGraphicsMode === "function") {
      (chromium as any).setGraphicsMode(false);
    }

    const executablePath = await chromium.executablePath();

    // The binary is extracted to /tmp at runtime; explicitly pointing
    // LD_LIBRARY_PATH at that directory ensures the dynamic linker finds
    // the .so files sitting right next to it instead of failing to
    // resolve them from the default search path.
    const path = await import("path");
    process.env.LD_LIBRARY_PATH = path.dirname(executablePath);

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
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
