import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = getSession();

  if (session) {
    await prisma.deviceSession.updateMany({
      where: { id: session.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookies().delete("atp_session");

  return NextResponse.json({ ok: true });
}
