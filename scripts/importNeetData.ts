// One-time (re-runnable) bulk import for:
//   1. CollegeAllotment — previous-year AIQ Round-1 seat-allotment records,
//      parsed from official MCC result PDFs (see prisma/seed-data/*.csv).
//   2. RankTrendPoint — official NEET-UG 2026 Re-NEET marks<->AIR anchor
//      points (see prisma/seed-data/rank-trend-2026.json).
//
// Usage (after `npx prisma generate` and after applying the schema SQL in
// Supabase's SQL Editor — see prisma/migrations/manual/*.sql):
//   npx tsx scripts/importNeetData.ts
//
// Safe to re-run: CollegeAllotment import clears each (year, round) slice
// before re-inserting (avoids duplicate rows on re-import); RankTrendPoint
// uses the existing upsert-on-[category,marks,year] unique constraint.

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import readline from "readline";

const prisma = new PrismaClient();

// Minimal CSV line parser — good enough for our own generated CSVs (only
// the `institute` field is ever quoted/escaped, RFC4180-style with "" for
// embedded quotes).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function importCollegeAllotments(csvPath: string, year: number, round: string) {
  console.log(`\nImporting ${csvPath} (year=${year}, round="${round}")...`);

  const deleted = await prisma.collegeAllotment.deleteMany({ where: { year, round } });
  if (deleted.count > 0) {
    console.log(`  Cleared ${deleted.count} existing rows for year ${year} / ${round} before re-import.`);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header: string[] | null = null;
  let batch: any[] = [];
  let total = 0;
  const BATCH_SIZE = 1000;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.collegeAllotment.createMany({ data: batch });
    total += batch.length;
    batch = [];
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ""));

    batch.push({
      year,
      round,
      rank: Number(row.rank),
      quota: row.quota,
      instituteName: row.institute,
      course: row.course,
      allottedCategory: row.allottedCategory,
      candidateCategory: row.candidateCategory,
      remarks: row.remarks || null,
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`  Inserted ${total} rows.`);
}

async function importRankTrendAnchors(jsonPath: string) {
  console.log(`\nImporting ${jsonPath}...`);
  const points = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  let count = 0;
  for (const p of points) {
    await prisma.rankTrendPoint.upsert({
      where: { category_marks_year: { category: p.category, marks: p.marks, year: p.year } },
      update: { expectedRank: p.expectedRank, confidence: p.confidence, source: p.source },
      create: p,
    });
    count++;
  }
  console.log(`  Upserted ${count} trend points.`);
}

async function main() {
  const seedDir = path.join(__dirname, "..", "prisma", "seed-data");

  await importCollegeAllotments(path.join(seedDir, "college-allotment-2025-round1.csv"), 2025, "Round 1");
  await importCollegeAllotments(path.join(seedDir, "college-allotment-2024-round1.csv"), 2024, "Round 1");
  await importRankTrendAnchors(path.join(seedDir, "rank-trend-2026.json"));

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
