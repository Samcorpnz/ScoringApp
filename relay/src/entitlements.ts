import { Request, Response, NextFunction } from "express";
import { prisma } from "@scorehub/db";

// Thrown by persistence.ts when a Free-tier account tries to bring up a
// second concurrent live match across any of its orgs. Caught at the HTTP
// route / socket call sites that can trigger match creation.
export class ConcurrentMatchLimitError extends Error {
  constructor() {
    super("Free plan allows one live match at a time across your account — upgrade to Pro for concurrent matches");
    this.name = "ConcurrentMatchLimitError";
  }
}

interface OrgAccount {
  accountId: string;
  plan: string;
}

// In legacy single-tenant mode (no DATABASE_URL — self-hosted, no billing
// system at all) there's nothing to gate, so callers get an unrestricted
// result rather than being locked to "free".
export async function getOrgAccount(orgId: string): Promise<OrgAccount | null> {
  if (!process.env.DATABASE_URL) return null;
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { accountId: true, account: { select: { plan: true } } },
  });
  if (!org) return null;
  return { accountId: org.accountId, plan: org.account.plan };
}

function upgradeMessage(allowed: string[]): string {
  const names = allowed.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" or ");
  return `This feature requires the ${names} plan — upgrade at /account/billing`;
}

// Express middleware factory gating a route behind one or more plans. Must
// run after controlAuth, which sets req.orgId — and, per the Phase 3
// rate-limiting bug, after controlRateLimit too, so unauthenticated requests
// are still throttled before any of this runs.
export function requirePlan(allowed: string[]) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!process.env.DATABASE_URL) {
      next();
      return;
    }
    const orgId = (req as any).orgId as string | undefined;
    if (!orgId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const account = await getOrgAccount(orgId);
    if (!account || !allowed.includes(account.plan)) {
      res.status(403).json({ error: upgradeMessage(allowed) });
      return;
    }
    next();
  };
}
