import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";

// Invalidates every /display/* URL currently in circulation for this match
// (a leaked link, a stale OBS scene file, a copy-pasted bookmark) without
// ending the match — see the Match.displayToken schema comment and
// DISPLAY_TOKEN_REQUIRED in relay/src/server.ts. The control panel's
// Outputs tab re-fetches the new token on its next render, so freshly
// copied/opened links keep working; anything using the old token starts
// failing immediately once enforcement is on.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; matchId: string }> }) {
  const { orgId, matchId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.activeRole !== "ADMIN" && session.user.activeRole !== "MANAGER") {
    return NextResponse.json({ error: "forbidden — admin or manager role required" }, { status: 403 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { orgId: true } });
  if (match?.orgId !== orgId) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }

  const displayToken = crypto.randomBytes(24).toString("hex");
  await prisma.match.update({ where: { id: matchId }, data: { displayToken } });

  return NextResponse.json({ displayToken });
}
