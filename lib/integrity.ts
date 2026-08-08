// Exam Integrity Score: starts at 100, drops by a type-specific weight for
// every violation logged during an attempt. More serious violations
// (leaving fullscreen, devtools) cost more than minor ones.
//
// This is intentionally simple/transparent (sum of weighted deductions,
// clamped at 0) rather than a black-box model — Admins reviewing the
// Security Center need to be able to explain a low score to a student.

export const VIOLATION_WEIGHTS: Record<string, number> = {
  TAB_SWITCH: 5,
  FULLSCREEN_EXIT: 8,
  DEVTOOLS_OPEN: 10,
  NETWORK_DISCONNECT: 3,
  REFRESH: 4,
  MULTI_LOGIN: 15,
  DEVICE_CHANGE: 10,
  UNKNOWN: 5,
};

export const VIOLATION_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab / Window Switch",
  FULLSCREEN_EXIT: "Exited Fullscreen",
  DEVTOOLS_OPEN: "Developer Tools Opened",
  NETWORK_DISCONNECT: "Network Disconnected",
  REFRESH: "Page Refreshed",
  MULTI_LOGIN: "Multiple Device Login",
  DEVICE_CHANGE: "Device Changed",
  UNKNOWN: "Unknown Violation",
};

export function computeIntegrityScore(violationTypes: string[]): number {
  const totalDeduction = violationTypes.reduce(
    (sum, type) => sum + (VIOLATION_WEIGHTS[type] ?? VIOLATION_WEIGHTS.UNKNOWN),
    0
  );
  return Math.max(0, 100 - totalDeduction);
}

export function integrityBand(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Clean", color: "text-success" };
  if (score >= 70) return { label: "Minor Flags", color: "text-warning" };
  if (score >= 40) return { label: "Suspicious", color: "text-orange-600" };
  return { label: "High Risk", color: "text-danger" };
}
