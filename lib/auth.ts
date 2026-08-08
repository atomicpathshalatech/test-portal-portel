import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

import type { AppRole } from "./permissions";

export type SessionUser = { id: string; name: string; role: AppRole; sessionId: string };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signToken(user: SessionUser) {
  return jwt.sign(user, SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

// Read the logged-in user from the session cookie (server components / route handlers)
export function getSession(): SessionUser | null {
  const token = cookies().get("atp_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Like getSession(), but also checks the DeviceSession table — so a session
// that was revoked (e.g. because the account logged in on another device
// under the single-session policy) is correctly rejected even though the
// JWT itself is still cryptographically valid. Only worth the extra DB hit
// on exam-critical routes (starting/continuing an attempt), not every
// request.
export async function getValidSession(): Promise<SessionUser | null> {
  const base = getSession();
  if (!base) return null;
  // Imported lazily to avoid a circular import with lib/prisma in edge contexts.
  const { prisma } = await import("./prisma");
  const session = await prisma.deviceSession.findUnique({ where: { id: base.sessionId } });
  if (!session || session.revokedAt) return null;
  return base;
}
