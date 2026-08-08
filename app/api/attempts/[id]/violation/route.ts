import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidSession } from "@/lib/auth";
import { computeIntegrityScore } from "@/lib/integrity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getValidSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.attempt.findUnique({ where: { id: params.id } });
  if (!attempt || attempt.studentId !== session.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { type } = await req.json();
  await prisma.attemptViolation.create({
    data: { attemptId: params.id, type: type || "UNKNOWN" },
  });

  const violations = await prisma.attemptViolation.findMany({
    where: { attemptId: params.id },
    orderBy: { timestamp: "asc" },
  });
  const violationCount = violations.length;
  const integrityScore = computeIntegrityScore(violations.map((v) => v.type));

  await prisma.attempt.update({
    where: { id: params.id },
    data: { integrityScore },
  });

  // 3-strike rule: auto-submit handled client-side by checking this count in response
  return NextResponse.json({ violationCount, integrityScore });
}
