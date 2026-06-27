import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";

// Revokes a leaked/rotated bridge token. relay/src/auth.ts's verifyBridgeSecret
// already rejects tokens with revokedAt set — this is the only way to set it
// short of a direct DB write (see SA-82).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; tokenId: string }> }
) {
  const { orgId, tokenId } = await params;
  const session = await auth();
  if (!session?.user?.orgId || session.user.orgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden — admin role required" }, { status: 403 });
  }

  const token = await prisma.scopedToken.findUnique({ where: { id: tokenId } });
  if (!token || token.orgId !== orgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.scopedToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });

  return NextResponse.json({ status: "revoked" });
}
