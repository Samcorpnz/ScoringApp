import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

// GET /api/graphics/roster returns PII (names, bios, photo URLs), so — unlike
// /api/graphics/entitlement's plain boolean — it must not serve an org's
// roster unless that org actually holds the graphics-operator add-on.
// graphics-roster.test.ts covers legacy single-tenant mode (no DATABASE_URL,
// where orgHasAddOn no-ops); this file covers the multi-tenant gating itself.
jest.mock("@scorehub/db", () => {
  const orgs = new Map<string, { accountId: string }>();
  const accounts = new Map<string, { plan: string; addOns: string[] }>();
  const players = new Map<string, unknown[]>();

  return {
    __seed(orgId: string, accountId: string, addOns: string[] = []) {
      orgs.set(orgId, { accountId });
      accounts.set(accountId, { plan: "free", addOns });
    },
    __seedPlayers(orgId: string, rows: unknown[]) {
      players.set(orgId, rows);
    },
    __reset() {
      orgs.clear();
      accounts.clear();
      players.clear();
    },
    prisma: {
      org: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          const org = orgs.get(where.id);
          if (!org) return null;
          const account = accounts.get(org.accountId);
          return { accountId: org.accountId, account: { plan: account?.plan ?? "free", addOns: account?.addOns ?? [] } };
        }),
      },
      player: {
        findMany: jest.fn(async ({ where }: { where: { orgId: string; externalId?: { in: string[] } } }) => {
          const rows = (players.get(where.orgId) ?? []) as { externalId: string }[];
          const ids = where.externalId?.in;
          return ids ? rows.filter(r => ids.includes(r.externalId)) : rows;
        }),
      },
    },
  };
});

import { createServer } from "../server";
import * as db from "@scorehub/db";

const seed = (db as unknown as { __seed: (orgId: string, accountId: string, addOns?: string[]) => void }).__seed;
const seedPlayers = (db as unknown as { __seedPlayers: (orgId: string, rows: unknown[]) => void }).__seedPlayers;
const resetSeed = (db as unknown as { __reset: () => void }).__reset;

const BRIDGE_SECRET = "test-bridge-secret";
const CONTROL_SECRET = "test-control-secret";
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let uploadDir: string;

beforeAll(done => {
  process.env.DATABASE_URL = "postgresql://fake-for-tests";
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-roster-entitlement-test-"));
  ({ app, httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    uploadDir,
    allowedOrigins: ["http://localhost:3000"],
  }));
  httpServer.listen(0, () => done());
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  closeServer(done);
});

beforeEach(() => {
  resetSeed();
});

describe("GET /api/graphics/roster — add-on gating", () => {
  it("returns an empty roster for an org without the graphics-operator add-on, even if players exist", async () => {
    seed("org-without", "account-without", []);
    seedPlayers("org-without", [{ externalId: "1", provider: "vega", firstName: "A", lastName: "B", displayName: null, photoUrl: null, bio: null }]);

    const res = await request(app).get("/api/graphics/roster?org=org-without&externalId=1");
    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it("returns only the requested player(s) for an org with the graphics-operator add-on", async () => {
    seed("org-with", "account-with", ["graphics-operator"]);
    seedPlayers("org-with", [
      { externalId: "1", provider: "vega", firstName: "A", lastName: "B", displayName: null, photoUrl: null, bio: null },
      { externalId: "2", provider: "vega", firstName: "C", lastName: "D", displayName: null, photoUrl: null, bio: null },
    ]);

    const res = await request(app).get("/api/graphics/roster?org=org-with&externalId=1");
    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0].externalId).toBe("1");
  });

  it("returns an empty roster when no externalId is supplied, even with the add-on (no whole-roster dump)", async () => {
    seed("org-with", "account-with", ["graphics-operator"]);
    seedPlayers("org-with", [{ externalId: "1", provider: "vega", firstName: "A", lastName: "B", displayName: null, photoUrl: null, bio: null }]);

    const res = await request(app).get("/api/graphics/roster?org=org-with");
    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });

  it("returns an empty roster for an unknown org", async () => {
    const res = await request(app).get("/api/graphics/roster?org=does-not-exist&externalId=1");
    expect(res.status).toBe(200);
    expect(res.body.players).toEqual([]);
  });
});
