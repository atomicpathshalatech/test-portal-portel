import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { validatePasswordPolicy, isCommonWeakPassword } from "@/lib/passwordPolicy";

export async function POST(req: NextRequest) {
  const { token, password, confirmPassword } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ message: "Token and new password are required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ message: "Passwords do not match." }, { status: 400 });
  }
  const policyError = validatePasswordPolicy(password);
  if (policyError) return NextResponse.json({ message: policyError }, { status: 400 });
  if (isCommonWeakPassword(password)) {
    return NextResponse.json({ message: "This password is too common — please choose something more unique." }, { status: 400 });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ message: "This reset link is invalid or has expired. Please request a new one." }, { status: 400 });
  }

  // Reuse-prevention: reject if this matches any of the user's last 5 passwords.
  const recentHashes = await prisma.passwordHistory.findMany({
    where: { userId: resetToken.userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const h of recentHashes) {
    if (await bcrypt.compare(password, h.passwordHash)) {
      return NextResponse.json({ message: "You've used this password recently. Please choose a different one." }, { status: 400 });
    }
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordHistory.create({ data: { userId: resetToken.userId, passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    // Revoke all existing sessions — force re-login everywhere with the new password.
    prisma.deviceSession.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "Password was reset" },
    }),
  ]);

  return NextResponse.json({ message: "Password reset successfully. Please log in with your new password." });
}
