import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, name: true, email: true, role: true, subject: true,
      mobile: true, dateOfBirth: true, gender: true, photoUrl: true,
      state: true, city: true, institute: true, batch: true, course: true,
      studentIdCode: true, createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Deliberately NOT editable by the user themselves: role, email (identity
  // key), studentIdCode (permanent), subject (admin-assigned for Teachers).
  const allowed = ["name", "mobile", "dateOfBirth", "gender", "photoUrl", "state", "city", "institute", "batch", "course"];
  const data: any = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      data[key] = key === "dateOfBirth" && body[key] ? new Date(body[key]) : body[key];
    }
  }

  const updated = await prisma.user.update({ where: { id: session.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name });
}
