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
// @sparticuz/chromium reads the Lambda runtime hint as soon as it is
// imported, so getBrowser sets AWS_LAMBDA_JS_RUNTIME before the dynamic
// import when the host has not provided AWS_EXECUTION_ENV.

function ensureServerlessChromiumRuntimeHint() {
  if (process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_JS_RUNTIME) return;

  const major = Number(process.versions.node.split(".")[0]);
  process.env.AWS_LAMBDA_JS_RUNTIME = major >= 22 ? "nodejs22.x" : "nodejs20.x";
}

function prependLibraryPath(path: string) {
  const existing = process.env.LD_LIBRARY_PATH;
  if (!existing) {
    process.env.LD_LIBRARY_PATH = path;
    return;
  }
  if (!existing.split(":").includes(path)) {
    process.env.LD_LIBRARY_PATH = `${path}:${existing}`;
  }
}

export async function getBrowser() {
  if (process.env.VERCEL) {
    ensureServerlessChromiumRuntimeHint();

    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    // Disabling graphics mode avoids a class of missing-shared-library
    // crashes (libnss3.so among them) on serverless runtimes that don't
    // have a GPU/graphics stack — Chromium doesn't need one for headless
    // PDF/screenshot rendering anyway.
    (chromium as any).setGraphicsMode = false;

    const executablePath = await chromium.executablePath();

    // @sparticuz/chromium extracts system libraries under these folders.
    // Keep them in the child process search path so Chromium can resolve
    // libnss3.so and friends at launch time.
    prependLibraryPath("/tmp/al2023/lib");
    prependLibraryPath("/tmp/al2/lib");

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}
