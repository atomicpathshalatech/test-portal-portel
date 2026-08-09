export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Password must include at least one special character (e.g. !@#$%^&*).";
  }
  return null;
}

// Very common/weak passwords that technically satisfy the character-class
// rules above but are still trivially guessable — reject them explicitly.
const COMMON_WEAK_PASSWORDS = ["password", "12345678", "qwerty123", "password1", "admin123", "welcome1"];

export function isCommonWeakPassword(password: string): boolean {
  return COMMON_WEAK_PASSWORDS.includes(password.toLowerCase());
}
