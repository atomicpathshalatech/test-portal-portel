import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { isManagerTier, canCreateRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const role = req.nextUrl.searchParams.get("role");
  const users = await prisma.user.findMany({
    where: { role: role ? (role as any) : { not: "STUDENT" } }, // default: staff accounts only
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subject: true,
      institute: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || !isManagerTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, role, subject } = await req.json();
  if (!name || !email || !password || !role) {
    return NextResponse.json({ message: "name, email, password and role are required" }, { status: 400 });
  }

  if (!canCreateRole(session.role, role)) {
    return NextResponse.json(
      { message: `A ${session.role.replace("_", " ")} cannot create a ${role.replace("_", " ")} account` },
      { status: 403 }
    );
  }

  if (role === "TEACHER" && !subject) {
    return NextResponse.json({ message: "Teachers must have a subject assigned" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "A user with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, subject: role === "TEACHER" ? subject : null },
    select: { id: true, name: true, email: true, role: true, subject: true },
  });

  await logAudit({
    userId: session.id,
    action: "CREATE_USER",
    entityType: "User",
    entityId: user.id,
    details: `${user.name} (${user.role})`,
  });

  return NextResponse.json(user, { status: 201 });
}
