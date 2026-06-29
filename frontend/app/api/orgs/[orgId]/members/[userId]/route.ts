import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@scorehub/db";
import { auth } from "@/auth";
import { canManageMembers, canActOnRole } from "@/lib/roles";

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];

async function isLastAdmin(orgId: string, userId: string, currentRole: Role): Promise<boolean> {
  if (currentRole !== "ADMIN") return false;
  const otherAdmins = await prisma.membership.count({
    where: { orgId, role: "ADMIN", userId: { not: userId } },
  });
  return otherAdmins === 0;
}

// Changes a member's role. ADMIN/MANAGER only; a MANAGER can't touch (or
// promote someone to) ADMIN/MANAGER — see lib/roles.ts. An org's last ADMIN
// can't be demoted, so an org can never end up with no ADMIN at all.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const { orgId, userId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageMembers(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const newRole = typeof body?.role === "string" ? (body.role as Role) : undefined;
  if (!newRole || !VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "a valid role is required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  if (!membership) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!canActOnRole(session.user.activeRole, membership.role) || !canActOnRole(session.user.activeRole, newRole)) {
    return NextResponse.json({ error: "you can't change this member's role" }, { status: 403 });
  }
  if (await isLastAdmin(orgId, userId, membership.role)) {
    return NextResponse.json({ error: "an org must keep at least one ADMIN" }, { status: 409 });
  }

  await prisma.membership.update({ where: { userId_orgId: { userId, orgId } }, data: { role: newRole } });

  return NextResponse.json({ status: "ok" });
}

// Removes a member from this org entirely. Same role-ceiling and
// last-ADMIN protections as PATCH above.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const { orgId, userId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageMembers(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }

  const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  if (!membership) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!canActOnRole(session.user.activeRole, membership.role)) {
    return NextResponse.json({ error: "you can't remove this member" }, { status: 403 });
  }
  if (await isLastAdmin(orgId, userId, membership.role)) {
    return NextResponse.json({ error: "an org must keep at least one ADMIN" }, { status: 409 });
  }

  await prisma.membership.delete({ where: { userId_orgId: { userId, orgId } } });

  return NextResponse.json({ status: "removed" });
}
