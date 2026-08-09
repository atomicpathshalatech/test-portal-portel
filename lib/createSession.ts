import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { signToken } from "./auth";
import { parseUserAgent, computeDeviceHash } from "./deviceFingerprint";
import type { AppRole } from "./permissions";

export async function createUserSession(
  user: { id: string; name: string; role: string; subject?: string | null },
  req: NextRequest,
  device?: { screenRes?: string; timezone?: string }
): Promise<string> {
  const userAgent = req.headers.get("user-agent") || "";
  const { browser, os, deviceType } = parseUserAgent(userAgent);
  const screenRes = device?.screenRes || null;
  const timezone = device?.timezone || null;
  const deviceHash = computeDeviceHash({ userAgent, screenRes: screenRes ?? undefined, timezone: timezone ?? undefined });
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const config =
    (await prisma.securityConfig.findUnique({ where: { id: "singleton" } })) ||
    (await prisma.securityConfig.create({ data: { id: "singleton", policy: "SINGLE_SESSION" } }));

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

  return signToken({
    id: user.id,
    name: user.name,
    role: user.role as AppRole,
    sessionId: session.id,
    subject: user.subject ?? null,
  });
}
