import { NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth";

export async function GET() {
  const session = await getValidSession();
  return NextResponse.json({ valid: !!session });
}
