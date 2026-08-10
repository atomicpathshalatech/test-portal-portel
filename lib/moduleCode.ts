import { prisma } from "./prisma";

export async function generateModuleCode(): Promise<string> {
  const prefix = "MOD";
  const latest = await prisma.module.findFirst({
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
