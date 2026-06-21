import { jwtVerify } from "jose";
import crypto from "crypto";
import { prisma } from "@scorehub/db";

// Used when DATABASE_URL is unset (local dev / Jest) — every connection
// shares one room, matching the relay's original single-tenant behaviour.
export const LEGACY_ROOM_ID = "legacy-single-tenant";

export interface AuthResult {
  orgId: string;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Bridge devices can't do an interactive login, so they authenticate with a
// long-lived per-org token (see POST /api/orgs/[orgId]/tokens in the frontend).
// Only its SHA-256 hash is ever stored.
export async function verifyBridgeSecret(
  secret: string | undefined,
  legacySecret: string
): Promise<AuthResult | null> {
  if (!secret) return null;

  if (!process.env.DATABASE_URL) {
    return secret === legacySecret ? { orgId: LEGACY_ROOM_ID } : null;
  }

  const token = await prisma.scopedToken.findUnique({ where: { tokenHash: hashToken(secret) } });
  if (!token || token.type !== "BRIDGE" || token.revokedAt) return null;
  return { orgId: token.orgId };
}

// The control panel authenticates with a short-lived JWT minted by the
// frontend's /api/control-token route from the logged-in user's session —
// not a long-lived shared secret. Requires ADMIN/OPERATOR role.
export async function verifyControlSecret(
  secret: string | undefined,
  legacySecret: string
): Promise<AuthResult | null> {
  if (!secret) return null;

  if (!process.env.DATABASE_URL) {
    return secret === legacySecret ? { orgId: LEGACY_ROOM_ID } : null;
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return null; // misconfigured multi-tenant deployment — fail closed

  try {
    const key = new TextEncoder().encode(authSecret);
    const { payload } = await jwtVerify(secret, key);
    const orgId = payload.orgId as string | undefined;
    const role = payload.role as string | undefined;
    if (!orgId || (role !== "ADMIN" && role !== "OPERATOR")) return null;
    return { orgId };
  } catch {
    return null;
  }
}
