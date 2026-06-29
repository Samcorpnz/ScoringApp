import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma, Role } from "@scorehub/db";
import { auth } from "@/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { canManageMembers, canActOnRole } from "@/lib/roles";
import { sendInvitationEmail } from "@/lib/email";

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60_000; // 7 days

// Invites someone into this org by email. ADMIN/MANAGER only, and the
// invited role can't exceed the inviter's own rank (see lib/roles.ts) so a
// MANAGER can't mint another ADMIN/MANAGER.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageMembers(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }
  if (isRateLimited(`invitations-create:${session.user.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? (body.role as Role) : undefined;

  if (!email || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
  }
  if (!canActOnRole(session.user.activeRole, role)) {
    return NextResponse.json({ error: "you can't invite someone at that role" }, { status: 403 });
  }

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { orgId } } },
  });
  if (existingUser?.memberships.length) {
    return NextResponse.json({ error: "that person is already a member of this org" }, { status: 409 });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

  await prisma.$transaction([
    // A fresh invite supersedes any earlier pending one to the same email
    // for this org — avoids accumulating stale duplicate invites.
    prisma.invitation.deleteMany({ where: { orgId, email, consumedAt: null, revokedAt: null } }),
    prisma.invitation.create({
      data: { orgId, email, role, tokenHash, invitedById: session.user.id, expiresAt },
    }),
  ]);

  await sendInvitationEmail({ to: email, orgName: org.name, role, token: rawToken });

  return NextResponse.json({ status: "sent" }, { status: 201 });
}

// Lists pending (not consumed/revoked/expired) invitations for this org.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageMembers(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { orgId, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}
