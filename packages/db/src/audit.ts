import { prisma } from "./client";

export interface AuditEventInput {
  // Dot-namespaced, e.g. "auth.failure", "permission.denied", "rate_limit.tripped".
  eventType: string;
  accountId?: string;
  orgId?: string;
  userId?: string;
  // Human-readable identifier of the actor when there's no resolvable userId
  // (an attempted email, a token label, an IP) — never a secret/raw token.
  actor?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget: audit logging must never block or fail the request it's
// describing, so this doesn't await the write. In legacy single-tenant mode
// (no DATABASE_URL) there's no AuditLog table to write to, so it's a no-op —
// same fallback used throughout relay/src/auth.ts and entitlements.ts.
export function recordAuditEvent(event: AuditEventInput): void {
  if (!process.env.DATABASE_URL) return;
  prisma.auditLog
    .create({
      data: {
        eventType: event.eventType,
        accountId: event.accountId,
        orgId: event.orgId,
        userId: event.userId,
        actor: event.actor,
        message: event.message,
        metadata: event.metadata as any,
      },
    })
    .catch(err => {
      console.error("[audit] failed to record event:", event.eventType, err);
    });
}
