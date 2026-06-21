import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@scoringapp/db";
import { auth } from "@/auth";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generates a per-org bridge credential. The plaintext is returned once and
// never stored — only its SHA-256 hash is persisted (see ScopedToken in
// packages/db/prisma/schema.prisma). The bridge config's BRIDGE_SECRET takes
// this value in place of the old relay-wide shared secret.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.orgId || session.user.orgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden — admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const label = typeof body?.label === "string" ? body.label.slice(0, 100) : undefined;

  const plaintext = crypto.randomBytes(32).toString("hex");
  await prisma.scopedToken.create({
    data: { orgId, type: "BRIDGE", tokenHash: hashToken(plaintext), label },
  });

  return NextResponse.json({ token: plaintext }, { status: 201 });
}
