import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Looks up a pending signup request by token (without consuming it) so the
// confirm page can show who/what org it's for before asking for a password.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const signupRequest = await prisma.signupRequest.findUnique({ where: { tokenHash } });
  if (!signupRequest || signupRequest.consumedAt || signupRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "this signup link is invalid or has expired" }, { status: 400 });
  }

  return NextResponse.json({
    email: signupRequest.email,
    name: signupRequest.name,
    orgName: signupRequest.orgName,
  });
}

// Deliberately no auth() requirement — the token (only ever sent to the
// requested email) is the proof of identity, same reasoning as
// api/invitations/accept/route.ts and api/account/email/confirm/route.ts.
export async function POST(req: NextRequest) {
  if (isRateLimited(`signup-confirm:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const signupRequest = await prisma.signupRequest.findUnique({ where: { tokenHash } });
  if (!signupRequest || signupRequest.consumedAt || signupRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "this signup link is invalid or has expired" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: signupRequest.email } });
  if (existingUser) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data: { name: signupRequest.orgName } });
    const org = await tx.org.create({ data: { accountId: account.id, name: signupRequest.orgName } });
    const user = await tx.user.create({
      data: {
        email: signupRequest.email,
        passwordHash,
        name: signupRequest.name,
        termsAcceptedAt: signupRequest.termsAcceptedAt,
        termsVersion: signupRequest.termsVersion,
      },
    });
    await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: "ADMIN" } });
    await tx.signupRequest.update({ where: { id: signupRequest.id }, data: { consumedAt: new Date() } });
  });

  return NextResponse.json({ status: "created" }, { status: 201 });
}
