import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

// Looks up a pending invitation by token (without consuming it) so the
// accept page can show the org name/role before asking for any input.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { org: { select: { name: true } } },
  });
  if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "this invitation is invalid or has expired" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

  return NextResponse.json({
    email: invitation.email,
    orgName: invitation.org.name,
    role: invitation.role,
    accountExists: Boolean(existingUser),
  });
}

// Deliberately no auth() requirement when creating a brand-new user — the
// token itself (only ever sent to the invited email) is the proof of
// identity, same reasoning as account/email/confirm/route.ts. When the
// invited email already has an account, the caller must be logged in as
// that user (checked below) so this can't be used to join an org as
// someone else just by knowing their email.
export async function POST(req: NextRequest) {
  if (isRateLimited(`invitations-accept:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "this invitation is invalid or has expired" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });

  if (existingUser) {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== existingUser.id) {
      return NextResponse.json({ error: "log in as the invited account to accept this invitation" }, {
        status: 401,
      });
    }

    const alreadyMember = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId: invitation.orgId } },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: "you're already a member of this org" }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.membership.create({
        data: { userId: existingUser.id, orgId: invitation.orgId, role: invitation.role },
      }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { consumedAt: new Date() } }),
    ]);

    return NextResponse.json({ status: "joined" });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !password) {
    return NextResponse.json({ error: "name and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: invitation.email, passwordHash, name } });
    await tx.membership.create({ data: { userId: user.id, orgId: invitation.orgId, role: invitation.role } });
    await tx.invitation.update({ where: { id: invitation.id }, data: { consumedAt: new Date() } });
  });

  return NextResponse.json({ status: "created" }, { status: 201 });
}
