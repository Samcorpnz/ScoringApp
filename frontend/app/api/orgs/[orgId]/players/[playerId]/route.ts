import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { validatePlayerField } from "@/lib/playerFields";

const GRAPHICS_ROLES = ["ADMIN", "MANAGER", "OPERATOR"] as const;

async function authorize(orgId: string) {
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!GRAPHICS_ROLES.includes(session.user.activeRole as (typeof GRAPHICS_ROLES)[number])) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (process.env.DATABASE_URL) {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { account: { select: { addOns: true } } },
    });
    if (!org?.account.addOns.includes("graphics-operator")) {
      return {
        error: NextResponse.json(
          { error: "This feature requires the graphics-operator add-on — upgrade at /account/billing" },
          { status: 403 }
        ),
      };
    }
  }
  return { error: null };
}

// Edits roster fields, including linking/unlinking a live feed identity
// (provider/externalId) and setting photoUrl (set by the relay's
// player-photo upload route, PATCHed here afterward — mirrors how logo
// uploads push logoUrl back onto MatchState via applyManualUpdate).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; playerId: string }> }
) {
  const { orgId, playerId } = await params;
  const { error } = await authorize(orgId);
  if (error) return error;

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const data: Record<string, string | null> = {};
  for (const field of ["firstName", "lastName", "displayName", "externalId", "provider", "bio", "photoUrl"] as const) {
    if (field in (body ?? {})) {
      const value = body[field];
      if (value !== null && typeof value !== "string") {
        return NextResponse.json({ error: `${field} must be a string or null` }, { status: 400 });
      }
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed) {
        const err = validatePlayerField(field, trimmed);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
      data[field] = trimmed || null;
    }
  }
  if ("firstName" in data && !data.firstName) {
    return NextResponse.json({ error: "firstName cannot be empty" }, { status: 400 });
  }
  if ("lastName" in data && !data.lastName) {
    return NextResponse.json({ error: "lastName cannot be empty" }, { status: 400 });
  }

  try {
    const player = await prisma.player.update({ where: { id: playerId }, data });
    return NextResponse.json({ player });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "a player with that provider/externalId already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; playerId: string }> }
) {
  const { orgId, playerId } = await params;
  const { error } = await authorize(orgId);
  if (error) return error;

  const existing = await prisma.player.findUnique({ where: { id: playerId } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.player.delete({ where: { id: playerId } });

  return NextResponse.json({ status: "removed" });
}
