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
