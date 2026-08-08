import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@atp.test" },
    update: {},
    create: { name: "Admin", email: "admin@atp.test", passwordHash, role: "SUPER_ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "subadmin@atp.test" },
    update: {},
    create: { name: "Sub Admin", email: "subadmin@atp.test", passwordHash, role: "SUB_ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "physics.teacher@atp.test" },
    update: {},
    create: {
      name: "Rakesh Sharma",
      email: "physics.teacher@atp.test",
      passwordHash,
      role: "TEACHER",
      subject: "Physics",
    },
  });

  await prisma.user.upsert({
    where: { email: "student@atp.test" },
    update: {},
    create: {
      name: "Demo Student",
      email: "student@atp.test",
      passwordHash,
      role: "STUDENT",
      state: "Uttar Pradesh",
      city: "Aligarh",
      institute: "Atomic Pathshala",
      batch: "Dropper 2027",
    },
  });

  // A few extra demo students (different state/city/institute) purely so the
  // Leaderboard has something to show and its filters have real options.
  const extraStudents = [
    { name: "Ananya Sharma", email: "ananya@atp.test", state: "Delhi", city: "New Delhi", institute: "Allen Institute", batch: "Dropper 2027", score: 380 },
    { name: "Rahul Verma", email: "rahul@atp.test", state: "Rajasthan", city: "Kota", institute: "Atomic Pathshala", batch: "Target 2027", score: 350 },
    { name: "Priya Singh", email: "priya@atp.test", state: "Uttar Pradesh", city: "Lucknow", institute: "Allen Institute", batch: "Dropper 2027", score: 410 },
  ];
  for (const s of extraStudents) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: "STUDENT",
        state: s.state,
        city: s.city,
        institute: s.institute,
        batch: s.batch,
      },
    });
  }

  const series = await prisma.testSeries.upsert({
    where: { code: "NEET27" },
    update: {},
    create: { name: "NEET 2027 Test Series", code: "NEET27", targetBatch: "Dropper 2027" },
  });

  const q1 = await prisma.question.create({
    data: {
      subject: "Physics",
      topic: "Laws of Motion",
      type: "SINGLE_CORRECT",
      difficulty: "EASY",
      translations: {
        create: [
          {
            language: "en",
            statement: "Newton's first law is also known as the law of:",
            options: [
              { id: "A", text: "Inertia" },
              { id: "B", text: "Momentum" },
              { id: "C", text: "Gravitation" },
              { id: "D", text: "Action-Reaction" },
            ],
            correctOptionIds: ["A"],
          },
          {
            language: "hi",
            statement: "न्यूटन का पहला नियम किस नाम से भी जाना जाता है:",
            options: [
              { id: "A", text: "जड़त्व" },
              { id: "B", text: "संवेग" },
              { id: "C", text: "गुरुत्वाकर्षण" },
              { id: "D", text: "क्रिया-प्रतिक्रिया" },
            ],
            correctOptionIds: ["A"],
          },
        ],
      },
    },
  });

  const q2 = await prisma.question.create({
    data: {
      subject: "Chemistry",
      topic: "Periodic Table",
      type: "SINGLE_CORRECT",
      difficulty: "MEDIUM",
      translations: {
        create: [
          {
            language: "en",
            statement: "Which element has the highest electronegativity?",
            options: [
              { id: "A", text: "Oxygen" },
              { id: "B", text: "Fluorine" },
              { id: "C", text: "Nitrogen" },
              { id: "D", text: "Chlorine" },
            ],
            correctOptionIds: ["B"],
          },
          {
            language: "hi",
            statement: "किस तत्व की विद्युत ऋणात्मकता सबसे अधिक होती है?",
            options: [
              { id: "A", text: "ऑक्सीजन" },
              { id: "B", text: "फ्लोरीन" },
              { id: "C", text: "नाइट्रोजन" },
              { id: "D", text: "क्लोरीन" },
            ],
            correctOptionIds: ["B"],
          },
        ],
      },
    },
  });

  const now = new Date();
  const physicsTeacher = await prisma.user.findUnique({ where: { email: "physics.teacher@atp.test" } });
  const test = await prisma.test.upsert({
    where: { code: "10001" },
    update: {},
    create: {
      testSeriesId: series.id,
      name: "NEET Grand Test 01",
      code: "10001",
      languageMode: "BOTH",
      durationMin: 180,
      openTime: new Date(now.getTime() - 60 * 60 * 1000),
      closeTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      correctMarks: 4,
      incorrectMarks: -1,
      status: "PUBLISHED", // students only ever see PUBLISHED tests — must be set for the demo to work
      createdById: physicsTeacher?.id,
      sections: {
        create: [
          { name: "Physics", subject: "Physics", targetCount: 1, order: 0, questions: { create: [{ questionId: q1.id, order: 0 }] } },
          { name: "Chemistry", subject: "Chemistry", targetCount: 1, order: 1, questions: { create: [{ questionId: q2.id, order: 0 }] } },
        ],
      },
    },
  });

  // Create already-submitted attempts for the extra demo students so the
  // Leaderboard has real ranked entries right away. Ranked by score desc.
  const ranked = [...extraStudents].sort((a, b) => b.score - a.score);
  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    const user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) continue;
    await prisma.attempt.upsert({
      where: { testId_studentId: { testId: test.id, studentId: user.id } },
      update: {},
      create: {
        testId: test.id,
        studentId: user.id,
        status: "SUBMITTED",
        submittedAt: now,
        score: s.score,
        rank: i + 1,
      },
    });
  }

  console.log("Seed complete:", { series: series.code, test: test.code });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
