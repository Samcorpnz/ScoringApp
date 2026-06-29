import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

// Provisions (or confirms) an org's active match. The relay's GET /state
// already does a find-or-create per orgId (relay/src/persistence.ts) and
// enforces the free-tier concurrent-match limit — this route just calls
// that over HTTP from the dashboard so onboarding can surface a ready
// shareable URL without duplicating relay's Prisma logic here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${RELAY_URL}/state?org=${encodeURIComponent(orgId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: body?.error ?? "failed to provision match" }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
