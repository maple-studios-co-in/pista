import { prisma } from "./db";

// Records a platform action. Never throws — auditing must not break a request.
export async function logAudit({ session, action, target = null, meta = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: session?.user?.id || null,
        actorEmail: session?.user?.email || null,
        actorRole: session?.user?.role || null,
        action,
        target,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    /* swallow */
  }
}
