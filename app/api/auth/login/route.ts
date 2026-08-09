import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createUserSession } from "@/lib/createSession";

export async function POST(req: NextRequest) {
  const { email, password, device } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ message: "Email and password required" }, { status: 400 });
  }

  const ipAddressForRateLimit = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // Basic account-lockout: 5 failed attempts on this email within the last
  // 15 minutes blocks further tries, regardless of whether the account
  // exists (avoids leaking which emails are registered).
  const recentFailures = await prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (recentFailures >= 5) {
    return NextResponse.json(
      { message: "Too many failed attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && (await verifyPassword(password, user.passwordHash));

  await prisma.loginAttempt.create({
    data: { email, success: !!valid, ipAddress: ipAddressForRateLimit, userId: user?.id },
  });

  if (!valid) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
  if (user && user.isActive === false) {
    return NextResponse.json({ message: "This account has been deactivated. Contact support." }, { status: 403 });
  }

  const token = await createUserSession(user, req, device);

  const res = NextResponse.json({ role: user.role });
  res.cookies.set("atp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return res;
}
