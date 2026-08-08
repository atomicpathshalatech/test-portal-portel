import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json(
      { message: "Your session has ended — you may have logged in on another device. Please sign in again." },
      { status: 401 }
    );
  }
  if (session.role !== "STUDENT") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { testId, dppId } = await req.json();

  if (testId) {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) return NextResponse.json({ message: "Test not found" }, { status: 404 });
    if (test.status !== "PUBLISHED") {
      return NextResponse.json({ message: "This test is not published yet" }, { status: 403 });
    }
    const now = new Date();
    if (now < test.openTime) return NextResponse.json({ message: "Test has not opened yet" }, { status: 403 });
    if (now > test.closeTime) return NextResponse.json({ message: "Test window has closed" }, { status: 403 });

    let attempt = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId, studentId: session.id } },
    });
    if (!attempt) {
      try {
        attempt = await prisma.attempt.create({ data: { testId, studentId: session.id } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          attempt = await prisma.attempt.findUnique({ where: { testId_studentId: { testId, studentId: session.id } } });
        } else {
          throw err;
        }
      }
    }
    return NextResponse.json(attempt, { status: 201 });
  }

  if (dppId) {
    const dpp = await prisma.dpp.findUnique({ where: { id: dppId } });
    if (!dpp) return NextResponse.json({ message: "DPP not found" }, { status: 404 });
    if (dpp.status !== "PUBLISHED") {
      return NextResponse.json({ message: "This DPP is not published yet" }, { status: 403 });
    }
    // DPPs have no open/close time window — practice anytime.
    let attempt = await prisma.attempt.findUnique({
      where: { dppId_studentId: { dppId, studentId: session.id } },
    });
    if (!attempt) {
      try {
        attempt = await prisma.attempt.create({ data: { dppId, studentId: session.id } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          attempt = await prisma.attempt.findUnique({ where: { dppId_studentId: { dppId, studentId: session.id } } });
        } else {
          throw err;
        }
      }
    }
    return NextResponse.json(attempt, { status: 201 });
  }

  return NextResponse.json({ message: "testId or dppId is required" }, { status: 400 });
}
