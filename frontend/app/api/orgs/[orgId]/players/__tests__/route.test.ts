// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const orgFindUniqueMock = vi.fn();
const playerFindManyMock = vi.fn();
const playerCreateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    org: { findUnique: (...a: unknown[]) => orgFindUniqueMock(...a) },
    player: {
      findMany: (...a: unknown[]) => playerFindManyMock(...a),
      create: (...a: unknown[]) => playerCreateMock(...a),
    },
  },
}));

function makeGetRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/players");
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orgs/org-1/players", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ orgId: "org-1" });

describe("/api/orgs/[orgId]/players", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    orgFindUniqueMock.mockReset();
    playerFindManyMock.mockReset();
    playerCreateMock.mockReset();
    delete process.env.DATABASE_URL;
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
  });

  describe("authorize()", () => {
    it("401s when there's no session", async () => {
      authMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("401s when the session's activeOrgId doesn't match the route param", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role outside ADMIN/MANAGER/OPERATOR", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "VIEWER" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("403s when DATABASE_URL is set and the org lacks the graphics-operator add-on", async () => {
      process.env.DATABASE_URL = "postgres://test";
      orgFindUniqueMock.mockResolvedValue({ account: { addOns: [] } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/graphics-operator add-on/);
    });

    it("succeeds when DATABASE_URL is set and the org has the add-on", async () => {
      process.env.DATABASE_URL = "postgres://test";
      orgFindUniqueMock.mockResolvedValue({ account: { addOns: ["graphics-operator"] } });
      playerFindManyMock.mockResolvedValue([]);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(200);
    });

    it("skips the add-on check entirely in legacy mode (no DATABASE_URL)", async () => {
      playerFindManyMock.mockResolvedValue([]);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(200);
      expect(orgFindUniqueMock).not.toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    it("returns the org's players ordered by lastName/firstName", async () => {
      const players = [{ id: "p1", firstName: "Ann", lastName: "Lee" }];
      playerFindManyMock.mockResolvedValue(players);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(await res.json()).toEqual({ players });
      expect(playerFindManyMock).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
    });
  });

  describe("POST", () => {
    it("400s when firstName is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ lastName: "Lee" }), { params });
      expect(res.status).toBe(400);
    });

    it("400s when lastName is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ firstName: "Ann" }), { params });
      expect(res.status).toBe(400);
    });

    it("400s on unparseable JSON body", async () => {
      const { POST } = await import("../route");
      const req = new NextRequest("http://localhost/api/orgs/org-1/players", { method: "POST", body: "not json" });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });

    it("400s when a field exceeds its max length", async () => {
      const { POST } = await import("../route");
      const res = await POST(
        makePostRequest({ firstName: "A".repeat(101), lastName: "Lee" }),
        { params },
      );
      expect(res.status).toBe(400);
    });

    it("trims whitespace and treats blank optional fields as null", async () => {
      playerCreateMock.mockResolvedValue({ id: "p1" });
      const { POST } = await import("../route");
      await POST(
        makePostRequest({ firstName: "  Ann  ", lastName: "  Lee ", displayName: "   " }),
        { params },
      );
      expect(playerCreateMock).toHaveBeenCalledWith({
        data: {
          orgId: "org-1",
          firstName: "Ann",
          lastName: "Lee",
          displayName: null,
          externalId: null,
          provider: null,
          bio: null,
        },
      });
    });

    it("creates a player and returns 201", async () => {
      const player = { id: "p1", firstName: "Ann", lastName: "Lee" };
      playerCreateMock.mockResolvedValue(player);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ firstName: "Ann", lastName: "Lee" }), { params });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ player });
    });

    it("409s on a duplicate provider/externalId (Prisma P2002)", async () => {
      playerCreateMock.mockRejectedValue({ code: "P2002" });
      const { POST } = await import("../route");
      const res = await POST(
        makePostRequest({ firstName: "Ann", lastName: "Lee", provider: "championdata", externalId: "42" }),
        { params },
      );
      expect(res.status).toBe(409);
    });

    it("rethrows an unrelated database error", async () => {
      playerCreateMock.mockRejectedValue(new Error("connection lost"));
      const { POST } = await import("../route");
      await expect(POST(makePostRequest({ firstName: "Ann", lastName: "Lee" }), { params })).rejects.toThrow(
        "connection lost",
      );
    });
  });
});
