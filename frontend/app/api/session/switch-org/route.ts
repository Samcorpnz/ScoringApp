import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";

// Verifies the requesting user still has a live Membership in the target
// org before letting the client switch its active org. Deliberately
// re-queries the DB rather than trusting the JWT's cached membership list,
// so a membership revoked mid-session can't still be switched into. On
// success, the client calls useSession().update({ activeOrgId }) — see
// auth.ts's jwt callback — to actually move the session over.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "not a member of this org" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", orgId });
}
