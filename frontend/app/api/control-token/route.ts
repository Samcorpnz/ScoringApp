import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Mints a short-lived token the control panel presents to the relay instead
// of a long-lived shared CONTROL_SECRET. The relay verifies it with the same
// AUTH_SECRET (see relay/src/auth.ts verifyControlSecret).
//
// An optional ?matchId= scopes the token to one specific match (room
// `match:<id>` on the relay) instead of the org's singleton "default" match
// — omitting it preserves the original single-match behavior verbatim.
export async function GET(req: NextRequest) {
  // This route is fetched on every /control or /setup mount and again on
  // every matchId change (useControlToken.ts), not just the 50-minute
  // refresh interval — an operator rapidly switching between matches, or
  // creating several in a row, organically sends multiple requests per
  // second. 30/60s (SA-102) was tight enough that a normal rapid-match-
  // creation burst could trip it, and because isRateLimited's sliding window
  // counts every attempt including the ones it rejects, a client that
  // retries on failure can keep the window permanently topped up rather than
  // recovering — so this needs enough headroom that legitimate bursts don't
  // reach it in the first place, not just tighter client-side retry logic.
  // Matches the actionRateLimit ceiling relay/src/server.ts already uses for
  // similarly operator-driven, high-frequency traffic.
  if (isRateLimited(`control-token:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.activeOrgId || !session.user.activeRole) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "MANAGER", "OPERATOR"].includes(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 500 });
  }

  const matchId = req.nextUrl.searchParams.get("matchId") ?? undefined;
  if (matchId) {
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { orgId: true } });
    if (match?.orgId !== session.user.activeOrgId) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }
  }

  const token = await new SignJWT({ orgId: session.user.activeOrgId, role: session.user.activeRole, ...(matchId ? { matchId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(authSecret));

  return NextResponse.json({ token, expiresInSeconds: 3600 });
}
