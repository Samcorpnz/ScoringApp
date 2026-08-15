import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Looks up a pending reset request by token (without consuming it) so the
// reset page can confirm the link is still valid before asking for a
// password. Deliberately doesn't return which email it belongs to.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resetRequest = await prisma.passwordResetRequest.findUnique({ where: { tokenHash } });
  if (!resetRequest || resetRequest.consumedAt || resetRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "this reset link is invalid or has expired" }, { status: 400 });
  }

  return NextResponse.json({ status: "valid" });
}

// Deliberately no auth() requirement — the token (only ever sent to the
// account's own email) is the proof of identity, same reasoning as
// api/invitations/accept/route.ts.
export async function POST(req: NextRequest) {
  if (isRateLimited(`reset-password:${clientIp(req)}`, 10, 60_000)) {
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
  const resetRequest = await prisma.passwordResetRequest.findUnique({ where: { tokenHash } });
  if (!resetRequest || resetRequest.consumedAt || resetRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "this reset link is invalid or has expired" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetRequest.userId }, data: { passwordHash } }),
    prisma.passwordResetRequest.update({ where: { id: resetRequest.id }, data: { consumedAt: new Date() } }),
  ]);

  return NextResponse.json({ status: "ok" });
}
