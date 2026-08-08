import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin, QUESTION_IMAGES_BUCKET } from "@/lib/supabaseAdmin";

const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ message: "Only PNG, JPEG or WEBP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ message: "Image must be under 4MB" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `report-screenshots/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(QUESTION_IMAGES_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ message: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrlData.publicUrl });
}
