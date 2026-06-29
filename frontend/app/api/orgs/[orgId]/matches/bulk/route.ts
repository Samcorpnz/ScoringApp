import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@scorehub/db";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";
import { getTemplate, SPORT_TEMPLATES } from "@/app/sport-templates";
import { DEFAULT_MATCH_STATE } from "@/app/types";
import type { SportType } from "@/app/types";

const VALID_SPORTS = new Set(SPORT_TEMPLATES.map(t => t.sport));

interface FixtureRow {
  sport: string;
  competition?: string;
  home: string;
  visitor: string;
  scheduledAt?: string;
  matchName?: string;
}

interface RowError {
  row: number;
  error: string;
}

// Bulk-creates SCHEDULED matches from a parsed fixture list (CSV upload on
// the /dashboard "Upcoming" tab). Direct Prisma write, no relay round-trip —
// scheduling a fixture doesn't bring anything live, so the relay's
// concurrent-LIVE-match entitlement check doesn't apply here; it applies
// later, when someone actually opens a fixture's control panel (see
// relay/src/persistence.ts's SCHEDULED→LIVE transition).
//
// Gated to pro/venue plans — bulk fixture management is a venue/NSO feature,
// mirroring how relay/src/entitlements.ts gates logo/sound uploads.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.activeOrgId || session.user.activeOrgId !== orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.activeRole !== "ADMIN" && session.user.activeRole !== "OPERATOR") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const account = await getAccountForOrg(orgId);
  if (!account || !["pro", "venue"].includes(account.plan)) {
    return NextResponse.json(
      { error: "This feature requires the Pro or Venue plan — upgrade at /account/billing" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const rows: FixtureRow[] = Array.isArray(body?.fixtures) ? body.fixtures : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "no fixtures provided" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "too many fixtures in one upload (max 500)" }, { status: 400 });
  }

  const errors: RowError[] = [];
  rows.forEach((row, i) => {
    if (!row.sport || !VALID_SPORTS.has(row.sport as SportType)) {
      errors.push({ row: i, error: `unknown sport "${row.sport}"` });
    }
    if (!row.home?.trim()) errors.push({ row: i, error: "missing home team" });
    if (!row.visitor?.trim()) errors.push({ row: i, error: "missing visitor team" });
    if (row.scheduledAt && Number.isNaN(Date.parse(row.scheduledAt))) {
      errors.push({ row: i, error: `invalid scheduledAt "${row.scheduledAt}"` });
    }
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: "invalid fixtures", details: errors }, { status: 400 });
  }

  const created = await prisma.match.createMany({
    data: rows.map(row => {
      const sport = row.sport as SportType;
      const template = getTemplate(sport);
      const home = row.home.trim();
      const visitor = row.visitor.trim();
      return {
        orgId,
        status: "SCHEDULED",
        sport,
        competition: row.competition?.trim() || null,
        homeName: home,
        visitorName: visitor,
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
        state: {
          ...DEFAULT_MATCH_STATE,
          sport,
          matchName: row.matchName?.trim() || `${home} v ${visitor}`,
          clockSeconds: template.clockSeconds,
          countDown: template.countDown,
          possession: template.defaultPossession,
          home: { ...DEFAULT_MATCH_STATE.home, name: home },
          visitor: { ...DEFAULT_MATCH_STATE.visitor, name: visitor },
        } as object,
      };
    }),
  });

  return NextResponse.json({ created: created.count });
}
