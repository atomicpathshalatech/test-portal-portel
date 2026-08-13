import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isAdminTier } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const doubt = await prisma.doubt.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { name: true, studentIdCode: true, email: true } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!doubt) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!isAdminTier(session.role) && doubt.studentId !== session.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doubt);
}

// body: { action: "claim" | "respond", adminResponse?: string }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session || !isAdminTier(session.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const doubt = await prisma.doubt.findUnique({ where: { id: params.id } });
  if (!doubt) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { action, adminResponse } = await req.json();

  if (action === "claim") {
    const updated = await prisma.doubt.update({
      where: { id: params.id },
      data: { assignedToId: session.id, status: "IN_REVIEW" },
    });
    return NextResponse.json(updated);
  }

  if (action === "respond") {
    if (!adminResponse || !adminResponse.trim()) {
      return NextResponse.json({ message: "A response is required." }, { status: 400 });
    }
    const updated = await prisma.doubt.update({
      where: { id: params.id },
      data: { status: "ANSWERED", adminResponse, resolvedAt: new Date(), assignedToId: doubt.assignedToId || session.id },
    });

    await prisma.notification.create({
      data: {
        userId: doubt.studentId,
        type: "DOUBT_ANSWERED",
        title: "💬 Your Doubt Has Been Answered",
        message: adminResponse.length > 120 ? adminResponse.slice(0, 117) + "..." : adminResponse,
        deepLink: "/student/doubts",
      },
    });

    return NextResponse.json(updated);
  }

  if (action === "close") {
    const updated = await prisma.doubt.update({ where: { id: params.id }, data: { status: "CLOSED" } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
