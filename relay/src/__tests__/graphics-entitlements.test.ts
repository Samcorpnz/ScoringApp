// Unit tests for orgHasAddOn/requireAddOn in isolation (no HTTP route uses
// requireAddOn yet — Phase A gates only at socket-auth time via orgHasAddOn,
// see server.ts's io.use graphics branch and graphics.test.ts's coverage of
// that path end-to-end). These exercise the entitlements.ts functions
// directly against a mocked @scorehub/db, mirroring entitlements.test.ts's
// mock shape but including Account.addOns.

jest.mock("@scorehub/db", () => {
  const orgs = new Map<string, { accountId: string }>();
  const accounts = new Map<string, { plan: string; addOns: string[] }>();

  return {
    __seed(orgId: string, accountId: string, addOns: string[] = []) {
      orgs.set(orgId, { accountId });
      accounts.set(accountId, { plan: "free", addOns });
    },
    __reset() {
      orgs.clear();
      accounts.clear();
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
    },
  };
});

import { orgHasAddOn, requireAddOn } from "../entitlements";
import * as db from "@scorehub/db";

const seed = (db as unknown as { __seed: (orgId: string, accountId: string, addOns?: string[]) => void }).__seed;
const resetSeed = (db as unknown as { __reset: () => void }).__reset;

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  resetSeed();
});

describe("orgHasAddOn", () => {
  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  });

  it("is unrestricted in legacy single-tenant mode (no DATABASE_URL)", async () => {
    delete process.env.DATABASE_URL;
    expect(await orgHasAddOn("any-org", "graphics-operator")).toBe(true);
  });

  it("returns true only when the org's account has the named add-on", async () => {
    process.env.DATABASE_URL = "postgresql://fake-for-tests";
    seed("org-with", "account-with", ["graphics-operator"]);
    seed("org-without", "account-without", []);

    expect(await orgHasAddOn("org-with", "graphics-operator")).toBe(true);
    expect(await orgHasAddOn("org-without", "graphics-operator")).toBe(false);
  });

  it("returns false for an unknown org", async () => {
    process.env.DATABASE_URL = "postgresql://fake-for-tests";
    expect(await orgHasAddOn("does-not-exist", "graphics-operator")).toBe(false);
  });
});

describe("requireAddOn middleware", () => {
  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  });

  function mockReqRes(orgId: string | undefined) {
    const req = { orgId } as any;
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    } as any;
    return { req, res };
  }

  it("calls next() unconditionally in legacy single-tenant mode", async () => {
    delete process.env.DATABASE_URL;
    const middleware = requireAddOn("graphics-operator");
    const { req, res } = mockReqRes(undefined);
    const next = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("401s when req.orgId is missing", async () => {
    process.env.DATABASE_URL = "postgresql://fake-for-tests";
    const middleware = requireAddOn("graphics-operator");
    const { req, res } = mockReqRes(undefined);
    const next = jest.fn();
    await middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s with an upgrade message when the org lacks the add-on", async () => {
    process.env.DATABASE_URL = "postgresql://fake-for-tests";
    seed("org-without", "account-without", []);
    const middleware = requireAddOn("graphics-operator");
    const { req, res } = mockReqRes("org-without");
    const next = jest.fn();
    await middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/graphics-operator add-on/);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the org has the add-on", async () => {
    process.env.DATABASE_URL = "postgresql://fake-for-tests";
    seed("org-with", "account-with", ["graphics-operator"]);
    const middleware = requireAddOn("graphics-operator");
    const { req, res } = mockReqRes("org-with");
    const next = jest.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
