import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Mints a short-lived token for the Graphics Operator add-on's control UI
// (frontend/app/control/graphics), presented to the relay the same way the
// scoring control panel presents a control-token (see relay/src/auth.ts
// verifyGraphicsSecret). Per product decision, a scoring operator (ADMIN/
// MANAGER/OPERATOR) may also drive graphics scenes solo — this mints from
// the same session roles as /api/control-token, just with role: "graphics"
// in the JWT payload instead of the caller's actual scoring role.
export async function GET(req: NextRequest) {
  if (isRateLimited(`graphics-token:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.activeOrgId || !session.user.activeRole) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "MANAGER", "OPERATOR"].includes(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (process.env.DATABASE_URL) {
    const org = await prisma.org.findUnique({
      where: { id: session.user.activeOrgId },
      select: { account: { select: { addOns: true } } },
    });
    if (!org?.account.addOns.includes("graphics-operator")) {
      return NextResponse.json(
        { error: "This feature requires the graphics-operator add-on — upgrade at /account/billing" },
        { status: 403 }
      );
    }
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "AUTH_SECRET is not configured" }, { status: 500 });
  }

  const matchId = req.nextUrl.searchParams.get("matchId") ?? undefined;
  if (matchId) {
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { orgId: true } });
    if (!match || match.orgId !== session.user.activeOrgId) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }
  }

  const token = await new SignJWT({ orgId: session.user.activeOrgId, role: "graphics", ...(matchId ? { matchId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(authSecret));

  return NextResponse.json({ token, expiresInSeconds: 3600 });
}
