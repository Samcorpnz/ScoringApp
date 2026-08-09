// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const membershipFindManyMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    membership: { findMany: (...a: unknown[]) => membershipFindManyMock(...a) },
  },
}));

function makeGetRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/members");
}

const params = Promise.resolve({ orgId: "org-1" });

const memberships = [
  {
    userId: "u1",
    role: "ADMIN",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: "u1", name: "Ann Lee", email: "ann@example.com" },
  },
  {
    userId: "u2",
    role: "VIEWER",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    user: { id: "u2", name: "Bo Smith", email: "bo@example.com" },
  },
];

describe("/api/orgs/[orgId]/members", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    membershipFindManyMock.mockReset();
    membershipFindManyMock.mockResolvedValue(memberships);
  });

  describe("GET", () => {
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

    it("includes emails and canManage: true for an ADMIN", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.canManage).toBe(true);
      expect(body.members[0]).toEqual({
        userId: "u1",
        name: "Ann Lee",
        email: "ann@example.com",
        role: "ADMIN",
        memberSince: memberships[0].createdAt.toISOString(),
      });
    });

    it("includes emails and canManage: true for a MANAGER", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      const body = await res.json();
      expect(body.canManage).toBe(true);
    });

    it("omits emails and sets canManage: false for a VIEWER", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "VIEWER" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      const body = await res.json();
      expect(body.canManage).toBe(false);
      expect(body.members[0]).toEqual({
        userId: "u1",
        name: "Ann Lee",
        role: "ADMIN",
        memberSince: memberships[0].createdAt.toISOString(),
      });
      expect(body.members[0].email).toBeUndefined();
    });

    it("omits emails and sets canManage: false for an OPERATOR", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      const body = await res.json();
      expect(body.canManage).toBe(false);
      expect(body.members[0].email).toBeUndefined();
    });

    it("queries memberships ordered by createdAt asc", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
      const { GET } = await import("../route");
      await GET(makeGetRequest(), { params });
      expect(membershipFindManyMock).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  });
});
