// Calls the Google Gemini API directly (server-side only — keys must never
// reach the browser). Supports MULTIPLE API keys with automatic rotation:
// if one key hits its free-tier rate limit (HTTP 429) or quota (403), the
// next key is tried automatically, so authoring doesn't stall on the daily
// per-key limit.
//
// .env: GEMINI_API_KEYS="key1,key2,key3"  (comma-separated, no spaces needed)
//       GEMINI_API_KEY="key1"             (also supported, single key)
//
// Model naming: Gemini model versions get deprecated/shut down fairly often
// (Google gives a few months' notice). We default to "gemini-flash-latest",
// an alias Google keeps pointed at their current stable Flash model, so this
// doesn't need to be manually bumped every time a version is retired. Set
// GEMINI_MODEL in .env to pin an explicit version instead if you prefer.

function getApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// Best-effort rotation pointer — persists across calls within the same warm
// serverless instance (not guaranteed globally, but avoids always hammering
// key #1 first on every request within a session).
let lastGoodKeyIndex = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's free tier occasionally returns 503 "model overloaded" during
// traffic spikes — this is transient, so retry the SAME key a couple of
// times with a short backoff before giving up on it (and moving to the
// next key, if any, in the outer rotation loop).
async function fetchWithOverloadRetry(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  for (let i = 0; i < 2 && res.status === 503; i++) {
    await sleep(1000 * (i + 1));
    res = await fetch(url, init);
  }
  return res;
}

export async function callGemini(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      "No Gemini API key found — set GEMINI_API_KEY (or GEMINI_API_KEYS for multiple, comma-separated) in .env. Get a free key from https://aistudio.google.com/apikey"
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ parts: [{ text: opts.user }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens || 2000 },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const idx = (lastGoodKeyIndex + attempt) % apiKeys.length;
    const key = apiKeys[idx];

    let res: Response;
    try {
      res = await fetchWithOverloadRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
    } catch (err: any) {
      lastError = new Error(`Network error calling Gemini with key #${idx + 1}: ${err.message}`);
      continue;
    }

    // Rate-limited or quota-exhausted on THIS key — rotate to the next one.
    if (res.status === 429 || res.status === 403) {
      lastError = new Error(`Key #${idx + 1} is rate-limited or over quota (HTTP ${res.status})`);
      continue;
    }
    // Still overloaded after retries — try the next key, if any.
    if (res.status === 503) {
      lastError = new Error("Gemini is currently overloaded (high demand) — try again in a moment.");
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}) using key #${idx + 1}: ${text.slice(0, 300)}`);
    }

    // This key worked — remember it so the next call tries it first.
    lastGoodKeyIndex = idx;

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || "").join("");
    if (!text) {
      const finishReason = data.candidates?.[0]?.finishReason;
      throw new Error(`Gemini returned no text (finishReason: ${finishReason || "unknown"})`);
    }
    return text;
  }

  throw new Error(
    `All ${apiKeys.length} Gemini API key(s) are rate-limited or failed. Last error: ${lastError?.message || "unknown"}. Add more keys to GEMINI_API_KEYS or wait for quota to reset.`
  );
}

// Same as callGemini, but includes an image (base64, no data-URI prefix) in
// the request — used for extracting question text/options from a pasted
// screenshot via Gemini's vision capability.
export async function callGeminiVision(opts: {
  system: string;
  user: string;
  imageBase64: string;
  mimeType: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      "No Gemini API key found — set GEMINI_API_KEY (or GEMINI_API_KEYS for multiple, comma-separated) in .env. Get a free key from https://aistudio.google.com/apikey"
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [
      {
        parts: [{ text: opts.user }, { inline_data: { mime_type: opts.mimeType, data: opts.imageBase64 } }],
      },
    ],
    generationConfig: { maxOutputTokens: opts.maxTokens || 2000 },
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const idx = (lastGoodKeyIndex + attempt) % apiKeys.length;
    const key = apiKeys[idx];

    let res: Response;
    try {
      res = await fetchWithOverloadRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
    } catch (err: any) {
      lastError = new Error(`Network error calling Gemini with key #${idx + 1}: ${err.message}`);
      continue;
    }
    if (res.status === 429 || res.status === 403) {
      lastError = new Error(`Key #${idx + 1} is rate-limited or over quota (HTTP ${res.status})`);
      continue;
    }
    if (res.status === 503) {
      lastError = new Error("Gemini is currently overloaded (high demand) — try again in a moment.");
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}) using key #${idx + 1}: ${text.slice(0, 300)}`);
    }
    lastGoodKeyIndex = idx;
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || "").join("");
    if (!text) {
      const finishReason = data.candidates?.[0]?.finishReason;
      throw new Error(`Gemini returned no text (finishReason: ${finishReason || "unknown"})`);
    }
    return text;
  }
  throw new Error(`All ${apiKeys.length} Gemini API key(s) are rate-limited or failed. Last error: ${lastError?.message || "unknown"}.`);
}

// Gemini is instructed to return only JSON, but strips code-fences
// defensively in case it wraps the response in ```json ... ```.
//
// LLMs frequently forget to escape backslashes (very common in LaTeX, e.g.
// "\frac{1}{2}") and raw newlines inside JSON string values, which breaks
// JSON.parse. If the direct parse fails, we run a best-effort repair pass
// that walks the string and escapes anything invalid found *inside* a JSON
// string literal, then retry.
export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return JSON.parse(repairJsonEscaping(cleaned)) as T;
  }
}

function repairJsonEscaping(input: string): string {
  let result = "";
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === '"' && input[i - 1] !== "\\") {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === "\\") {
        const next = input[i + 1];
        if (next && '"\\/bfnrtu'.includes(next)) {
          // Valid 2-character escape (e.g. \\, \n, \t, \u...) — consume BOTH
          // characters now so the next loop iteration doesn't re-examine
          // `next` as if it were a fresh, independent character. Without
          // this, a correctly-escaped "\\alpha" (backslash-backslash-alpha,
          // meaning one literal backslash) gets mangled into three
          // backslashes because the second backslash gets treated as a new
          // stray escape on the following iteration.
          result += ch + next;
          i++;
        } else {
          result += "\\\\"; // stray backslash (e.g. from \frac, \beta, \(, \)) — escape it
        }
        continue;
      }
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        continue;
      }
    }

    result += ch;
  }
  return result;
}
