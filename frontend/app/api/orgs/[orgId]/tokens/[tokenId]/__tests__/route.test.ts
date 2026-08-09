// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const tokenFindUniqueMock = vi.fn();
const tokenUpdateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    scopedToken: {
      findUnique: (...a: unknown[]) => tokenFindUniqueMock(...a),
      update: (...a: unknown[]) => tokenUpdateMock(...a),
    },
  },
}));

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/tokens/tok-1", { method: "DELETE" });
}

const params = Promise.resolve({ orgId: "org-1", tokenId: "tok-1" });

describe("/api/orgs/[orgId]/tokens/[tokenId]", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    tokenFindUniqueMock.mockReset();
    tokenUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
    tokenFindUniqueMock.mockResolvedValue({ id: "tok-1", orgId: "org-1" });
  });

  describe("DELETE", () => {
    it("401s when there's no session", async () => {
      authMock.mockResolvedValue(null);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("401s when the session's activeOrgId doesn't match the route param", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role outside ADMIN/MANAGER", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("allows a MANAGER to revoke a token", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      tokenUpdateMock.mockResolvedValue({});
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(200);
    });

    it("404s when the token doesn't exist", async () => {
      tokenFindUniqueMock.mockResolvedValue(null);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("404s when the token belongs to a different org", async () => {
      tokenFindUniqueMock.mockResolvedValue({ id: "tok-1", orgId: "org-2" });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("revokes the token and returns status: revoked", async () => {
      tokenUpdateMock.mockResolvedValue({});
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "revoked" });
      expect(tokenUpdateMock).toHaveBeenCalledWith({
        where: { id: "tok-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
