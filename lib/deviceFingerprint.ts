import { createHash } from "crypto";

// Deliberately lightweight — no external UA-parsing library. Good enough to
// tell devices apart for security-center display and fingerprint hashing;
// not meant to be forensically precise.
export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: "mobile" | "desktop" } {
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  const deviceType: "mobile" | "desktop" = /Mobi|Android|iPhone|iPad/.test(ua) ? "mobile" : "desktop";

  return { browser, os, deviceType };
}

export function computeDeviceHash(parts: {
  userAgent: string;
  screenRes?: string;
  timezone?: string;
}): string {
  const raw = `${parts.userAgent}|${parts.screenRes || ""}|${parts.timezone || ""}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
