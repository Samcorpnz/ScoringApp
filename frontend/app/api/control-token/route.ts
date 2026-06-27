import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth } from "@/auth";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Mints a short-lived token the control panel presents to the relay instead
// of a long-lived shared CONTROL_SECRET. The relay verifies it with the same
// AUTH_SECRET (see relay/src/auth.ts verifyControlSecret).
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

  const token = await new SignJWT({ orgId: session.user.orgId, role: session.user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(authSecret));

  return NextResponse.json({ token, expiresInSeconds: 3600 });
}
