import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ message: "Email is required." }, { status: 400 });

  const genericResponse = {
    message: "If an account exists with that email, a password reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    // Same response whether the account exists or not — don't leak which
    // emails are registered.
    return NextResponse.json(genericResponse);
  }

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  const result = await sendEmail({
    to: user.email,
    subject: "Reset your Atomic Pathshala password",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #9D4400;">Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one — this link expires in 1 hour.</p>
      <a href="${resetLink}" style="display:inline-block; background:#9D4400; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin: 16px 0;">Reset My Password</a>
      <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      <p style="color: #94a3b8; font-size: 11px; word-break: break-all;">Or copy this link: ${resetLink}</p>
    </div>`,
  });

  if (!result.sent) {
    console.error("[forgot-password] Email failed to send:", result.error);
  }

  return NextResponse.json(genericResponse);
}
