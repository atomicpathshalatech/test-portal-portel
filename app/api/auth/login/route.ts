import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { parseUserAgent, computeDeviceHash } from "@/lib/deviceFingerprint";

export async function POST(req: NextRequest) {
  const { email, password, device } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ message: "Email and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  const { browser, os, deviceType } = parseUserAgent(userAgent);
  const screenRes = device?.screenRes || null;
  const timezone = device?.timezone || null;
  const deviceHash = computeDeviceHash({ userAgent, screenRes, timezone });
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const config =
    (await prisma.securityConfig.findUnique({ where: { id: "singleton" } })) ||
    (await prisma.securityConfig.create({ data: { id: "singleton", policy: "SINGLE_SESSION" } }));

  // Decide which of this user's currently-active sessions to revoke, based
  // on policy:
  //   SINGLE_SESSION  -> revoke everything (only one device, ever)
  //   MOBILE_PLUS_WEB -> revoke only sessions of the SAME device type
  //                      (so one mobile + one desktop can stay active together)
  //   UNLIMITED       -> revoke nothing (just logged for audit)
  if (config.policy !== "UNLIMITED") {
    const where =
      config.policy === "MOBILE_PLUS_WEB"
        ? { userId: user.id, revokedAt: null, deviceType }
        : { userId: user.id, revokedAt: null };

    await prisma.deviceSession.updateMany({
      where,
      data: {
        revokedAt: new Date(),
        revokedReason:
          config.policy === "MOBILE_PLUS_WEB"
            ? `New ${deviceType} login replaced this session`
            : "New login from another device",
      },
    });
  }

  const session = await prisma.deviceSession.create({
    data: { userId: user.id, deviceHash, deviceType, browser, os, timezone, screenRes, ipAddress },
  });

  const token = signToken({
    id: user.id,
    name: user.name,
    role: user.role as import("@/lib/permissions").AppRole,
    sessionId: session.id,
  });

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
