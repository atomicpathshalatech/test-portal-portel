import { prisma } from "./prisma";

export async function generateDppCode(): Promise<string> {
  const prefix = "AP";
  const latest = await prisma.dpp.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });

  let nextNumber = 1;
  if (latest) {
    const lastNumber = parseInt(latest.code.slice(prefix.length), 10);
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}
