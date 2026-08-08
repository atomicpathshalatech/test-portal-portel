import { prisma } from "./prisma";

export async function logAudit(opts: {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        details: opts.details,
      },
    });
  } catch {
    // Audit logging must never break the primary action it's logging.
  }
}
