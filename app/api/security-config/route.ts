import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const config =
    (await prisma.securityConfig.findUnique({ where: { id: "singleton" } })) ||
    (await prisma.securityConfig.create({ data: { id: "singleton", policy: "SINGLE_SESSION" } }));
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isSuperAdmin(session.role)) {
    return NextResponse.json({ message: "Only Super Admin can change this setting" }, { status: 401 });
  }
  const { policy } = await req.json();
  if (!["SINGLE_SESSION", "MOBILE_PLUS_WEB", "UNLIMITED"].includes(policy)) {
    return NextResponse.json({ message: "Invalid policy" }, { status: 400 });
  }
  const config = await prisma.securityConfig.upsert({
    where: { id: "singleton" },
    update: { policy },
    create: { id: "singleton", policy },
  });
  await logAudit({ userId: session.id, action: "CHANGE_LOGIN_POLICY", entityType: "SecurityConfig", details: policy });
  return NextResponse.json(config);
}
