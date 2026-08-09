import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { studentIdCode, dateOfBirth } = await req.json();
  if (!studentIdCode || !dateOfBirth) {
    return NextResponse.json({ message: "Student ID and Date of Birth are required." }, { status: 400 });
  }

  const student = await prisma.user.findUnique({
    where: { studentIdCode: studentIdCode.trim().toUpperCase() },
  });

  // Same generic error whether the ID doesn't exist or the DOB is wrong —
  // don't let an attacker learn which Student IDs are valid via a
  // different error message.
  const genericError = "Invalid Student ID or Date of Birth.";

  if (!student || student.role !== "STUDENT") {
    return NextResponse.json({ message: genericError }, { status: 401 });
  }
  if (student.isActive === false) {
    return NextResponse.json({ message: "This account has been deactivated. Contact support." }, { status: 403 });
  }
  if (!student.dateOfBirth) {
    return NextResponse.json({ message: genericError }, { status: 401 });
  }

  const providedDob = new Date(dateOfBirth).toISOString().slice(0, 10);
  const actualDob = student.dateOfBirth.toISOString().slice(0, 10);
  if (providedDob !== actualDob) {
    return NextResponse.json({ message: genericError }, { status: 401 });
  }

  return NextResponse.json({
    name: student.name,
    photoUrl: student.photoUrl,
    studentIdCode: student.studentIdCode,
  });
}
