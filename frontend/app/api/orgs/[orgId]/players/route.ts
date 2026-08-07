import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { validatePlayerField, type PlayerField } from "@/lib/playerFields";

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

type NewPlayerFields = {
  firstName: string;
  lastName: string;
  displayName: string | null;
  externalId: string | null;
  provider: string | null;
  bio: string | null;
};

// Trims and validates the new-player fields from the request body. Returns
// either the parsed fields or a NextResponse to return as-is.
function parseNewPlayer(body: unknown): NewPlayerFields | NextResponse {
  const b = (body as Record<string, unknown>) ?? {};
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
  }
  const displayName = typeof b.displayName === "string" ? b.displayName.trim() || null : null;
  const externalId = typeof b.externalId === "string" ? b.externalId.trim() || null : null;
  const provider = typeof b.provider === "string" ? b.provider.trim() || null : null;
  const bio = typeof b.bio === "string" ? b.bio.trim() || null : null;

  for (const [field, value] of Object.entries({ firstName, lastName, displayName, externalId, provider, bio })) {
    if (!value) continue;
    const err = validatePlayerField(field as PlayerField, value);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  return { firstName, lastName, displayName, externalId, provider, bio };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { error } = await authorize(orgId);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const fields = parseNewPlayer(body);
  if (fields instanceof NextResponse) return fields;

  try {
    const player = await prisma.player.create({ data: { orgId, ...fields } });
    return NextResponse.json({ player }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "a player with that provider/externalId already exists" }, { status: 409 });
    }
    throw err;
  }
}
