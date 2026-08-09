import { prisma } from "./prisma";

export async function generateStudentId(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `AP${yy}`;

  const latest = await prisma.user.findFirst({
    where: { studentIdCode: { startsWith: prefix } },
    orderBy: { studentIdCode: "desc" },
  });

  let nextNumber = 1;
  if (latest?.studentIdCode) {
    const lastNumber = parseInt(latest.studentIdCode.slice(prefix.length), 10);
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(6, "0")}`;
}
