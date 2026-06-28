import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { canManageMembers, canActOnRole } from "@/lib/roles";

// Revokes a pending invitation. ADMIN/MANAGER only, and a MANAGER can't
// revoke an invitation for an ADMIN/MANAGER role (mirrors the role-ceiling
// rule on creation in ../route.ts).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  const { orgId, invitationId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canManageMembers(session.user.activeRole)) {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.orgId !== orgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!canActOnRole(session.user.activeRole, invitation.role)) {
    return NextResponse.json({ error: "you can't revoke an invitation at that role" }, { status: 403 });
  }

  await prisma.invitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });

  return NextResponse.json({ status: "revoked" });
}
