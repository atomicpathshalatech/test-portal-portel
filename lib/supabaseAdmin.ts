import { createClient } from "@supabase/supabase-js";

// This client uses the SERVICE ROLE key — it must only ever be used
// server-side (API routes / server components), never sent to the browser.
// It's used only for uploading question images to Supabase Storage.

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env for image upload to work."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export const QUESTION_IMAGES_BUCKET = "question-images";

// Module Studio buckets — kept separate from question-images since these
// hold original PDFs (private) and derived page renders/exports (also
// private; served through signed URLs, not getPublicUrl).
export const MODULE_ORIGINALS_BUCKET = "module-originals";
export const MODULE_ASSETS_BUCKET = "module-assets";
export const MODULE_EXPORTS_BUCKET = "module-exports";
