import { NextResponse } from "next/server";
import { buildPyqSourceOptions } from "@/lib/questionCode";

export async function GET() {
  return NextResponse.json(buildPyqSourceOptions());
}
