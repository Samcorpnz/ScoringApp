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
  if (isRateLimited(`control-token:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 500 });
  }

  const matchId = req.nextUrl.searchParams.get("matchId") ?? undefined;
  if (matchId) {
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { orgId: true } });
    if (!match || match.orgId !== session.user.orgId) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }
  }

  const token = await new SignJWT({ orgId: session.user.orgId, role: session.user.role, ...(matchId ? { matchId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(authSecret));

  return NextResponse.json({ token, expiresInSeconds: 3600 });
}
