import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin, QUESTION_IMAGES_BUCKET } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  if (!photo || photo.size === 0) {
    return NextResponse.json({ message: "No photo provided" }, { status: 400 });
  }
  if (photo.size > 500 * 1024) {
    return NextResponse.json({ message: "Photo must be under 500KB" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const path = `profile-photos/${randomUUID()}.jpg`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error } = await supabase.storage.from(QUESTION_IMAGES_BUCKET).upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) return NextResponse.json({ message: `Upload failed: ${error.message}` }, { status: 500 });

    const { data } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
