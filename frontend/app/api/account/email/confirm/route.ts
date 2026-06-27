import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Deliberately no auth() call here — the link is opened from an email
// client, often in a different/logged-out browser session. The token
// itself is the proof of intent and identity: it was only ever sent to the
// new address, and minting it required the current account password.
export async function POST(req: NextRequest) {
  if (isRateLimited(`account-email-confirm:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const pendingRequest = await prisma.emailChangeRequest.findUnique({ where: { tokenHash } });

  if (!pendingRequest || pendingRequest.consumedAt || pendingRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "this link is invalid or has expired" }, { status: 400 });
  }

  const conflict = await prisma.user.findUnique({ where: { email: pendingRequest.newEmail } });
  if (conflict) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: pendingRequest.userId }, data: { email: pendingRequest.newEmail } }),
    prisma.emailChangeRequest.update({ where: { id: pendingRequest.id }, data: { consumedAt: new Date() } }),
  ]);

  return NextResponse.json({ status: "ok" });
}
