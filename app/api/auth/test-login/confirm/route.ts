import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSession } from "@/lib/createSession";

export async function POST(req: NextRequest) {
  const { studentIdCode, dateOfBirth, device } = await req.json();
  if (!studentIdCode || !dateOfBirth) {
    return NextResponse.json({ message: "Student ID and Date of Birth are required." }, { status: 400 });
  }

  const rateLimitKey = `testlogin:${studentIdCode}`;
  const ipAddressForRateLimit = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const recentFailures = await prisma.loginAttempt.count({
    where: { email: rateLimitKey, success: false, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (recentFailures >= 5) {
    return NextResponse.json({ message: "Too many failed attempts. Please try again in 15 minutes or contact the invigilator." }, { status: 429 });
  }

  const student = await prisma.user.findUnique({ where: { studentIdCode: studentIdCode.trim().toUpperCase() } });
  const genericError = "Invalid Student ID or Date of Birth.";

  let valid = false;
  if (student && student.role === "STUDENT" && student.dateOfBirth) {
    const providedDob = new Date(dateOfBirth).toISOString().slice(0, 10);
    const actualDob = student.dateOfBirth.toISOString().slice(0, 10);
    valid = providedDob === actualDob;
  }

  await prisma.loginAttempt.create({
    data: { email: rateLimitKey, success: valid, ipAddress: ipAddressForRateLimit, userId: student?.id },
  });

  if (!valid || !student) {
    return NextResponse.json({ message: genericError }, { status: 401 });
  }
  if (student.isActive === false) {
    return NextResponse.json({ message: "This account has been deactivated. Contact support." }, { status: 403 });
  }

  const token = await createUserSession(student, req, device);

  const res = NextResponse.json({ role: student.role, name: student.name });
  res.cookies.set("atp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return res;
}
