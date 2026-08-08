import { prisma } from "./prisma";

export async function generateTestSeriesCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TS-${year}-`;

  const latest = await prisma.testSeries.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });

  let nextNumber = 1;
  if (latest) {
    const lastNumber = parseInt(latest.code.slice(prefix.length), 10);
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}
