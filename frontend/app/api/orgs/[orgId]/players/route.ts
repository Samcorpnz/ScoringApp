import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";

const GRAPHICS_ROLES = ["ADMIN", "MANAGER", "OPERATOR"] as const;

// Roster management follows the same role gate as /api/graphics-token (not
// canManageMembers's ADMIN/MANAGER-only) since an OPERATOR may run the
// graphics side solo on smaller productions, same as driving scenes.
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { error } = await authorize(orgId);
  if (error) return error;

  const players = await prisma.player.findMany({
    where: { orgId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ players });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { error } = await authorize(orgId);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
  }
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() || null : null;
  const externalId = typeof body?.externalId === "string" ? body.externalId.trim() || null : null;
  const provider = typeof body?.provider === "string" ? body.provider.trim() || null : null;
  const bio = typeof body?.bio === "string" ? body.bio.trim() || null : null;

  try {
    const player = await prisma.player.create({
      data: { orgId, firstName, lastName, displayName, externalId, provider, bio },
    });
    return NextResponse.json({ player }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "a player with that provider/externalId already exists" }, { status: 409 });
    }
    throw err;
  }
}
