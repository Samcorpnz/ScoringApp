import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { canManageMembers } from "@/lib/roles";

// Lists this org's members. Any member can see the roster (not just
// ADMIN/MANAGER) — only invite/remove/role-change are management-gated.
// Email addresses are only included for callers who can manage members;
// lower-privilege roles (VIEWER/OPERATOR) get names/roles but not everyone's
// email.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const canManage = canManageMembers(session.user.activeRole);
  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    members: memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      ...(canManage ? { email: m.user.email } : {}),
      role: m.role,
      memberSince: m.createdAt,
    })),
    canManage,
  });
}
