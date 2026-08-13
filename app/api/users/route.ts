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
  const search = req.nextUrl.searchParams.get("search")?.trim();

  const where: any = { role: role ? (role as any) : { not: "STUDENT" } }; // default: staff accounts only
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
      { studentIdCode: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { state: { contains: search, mode: "insensitive" } },
      { course: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subject: true,
      institute: true,
      createdAt: true,
      // Registration-form fields — populated for students, null for staff
      // accounts that were created directly by an admin instead.
      mobile: true,
      studentIdCode: true,
      dateOfBirth: true,
      gender: true,
      state: true,
      city: true,
      category: true,
      subCategory: true,
      course: true,
      isActive: true,
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
