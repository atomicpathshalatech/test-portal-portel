import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { generateStudentId } from "@/lib/studentId";
import { validatePasswordPolicy, isCommonWeakPassword } from "@/lib/passwordPolicy";
import { sendEmail, buildWelcomeEmailHtml } from "@/lib/email";
import { getSupabaseAdmin, QUESTION_IMAGES_BUCKET } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const name = String(formData.get("name") || "").trim();
  const mobile = String(formData.get("mobile") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const dateOfBirth = String(formData.get("dateOfBirth") || "");
  const gender = String(formData.get("gender") || "");
  const state = String(formData.get("state") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const subCategory = String(formData.get("subCategory") || "None").trim();
  const course = String(formData.get("course") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const photo = formData.get("photo") as File | null;

  // ---- Validation ----
  if (!name || !mobile || !email || !dateOfBirth || !gender || !state || !city || !category || !course) {
    return NextResponse.json({ message: "All fields except photo and sub-category are required." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return NextResponse.json({ message: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ message: "Passwords do not match." }, { status: 400 });
  }
  const policyError = validatePasswordPolicy(password);
  if (policyError) return NextResponse.json({ message: policyError }, { status: 400 });
  if (isCommonWeakPassword(password)) {
    return NextResponse.json({ message: "This password is too common — please choose something more unique." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "An account with this email already exists. Try logging in instead." }, { status: 409 });
  }

  // ---- Photo upload (optional but recommended) ----
  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(photo.type)) {
      return NextResponse.json({ message: "Photo must be JPG or PNG." }, { status: 400 });
    }
    if (photo.size > 500 * 1024) {
      return NextResponse.json({ message: "Photo must be under 500KB." }, { status: 400 });
    }
    try {
      const supabase = getSupabaseAdmin();
      const ext = photo.type === "image/png" ? "png" : "jpg";
      const path = `student-photos/${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());
      const { error } = await supabase.storage.from(QUESTION_IMAGES_BUCKET).upload(path, buffer, {
        contentType: photo.type,
        upsert: false,
      });
      if (!error) {
        const { data } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    } catch {
      // Photo upload failing shouldn't block registration — just proceed without it.
    }
  }

  // ---- Create account ----
  const passwordHash = await hashPassword(password);
  const studentIdCode = await generateStudentId();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      mobile,
      passwordHash,
      role: "STUDENT",
      dateOfBirth: new Date(dateOfBirth),
      gender,
      state,
      city,
      category,
      subCategory,
      course,
      photoUrl,
      studentIdCode,
    },
  });

  await prisma.passwordHistory.create({ data: { userId: user.id, passwordHash } });

  // Best-effort — registration succeeds even if the email fails to send.
  const emailResult = await sendEmail({
    to: email,
    subject: "Welcome to Atomic Pathshala — Your Student ID",
    html: buildWelcomeEmailHtml({ name, studentId: studentIdCode, email }),
  });

  // Best-effort welcome notification — only ever fires here, after the
  // account row above has actually been created, so a failed/incomplete
  // registration (which would have thrown before this point) never sends one.
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "WELCOME",
        title: "👋 Welcome to Atomic Pathshala!",
        message: "Welcome! Your preparation journey starts here. Stay consistent, keep learning, and keep moving forward. 🚀",
        deepLink: "/student",
      },
    });
  } catch {
    // Non-critical — don't fail registration over a notification row.
  }

  return NextResponse.json(
    { id: user.id, studentIdCode, emailSent: emailResult.sent },
    { status: 201 }
  );
}
