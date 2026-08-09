// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const invitationFindUniqueMock = vi.fn();
const invitationUpdateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    invitation: {
      findUnique: (...a: unknown[]) => invitationFindUniqueMock(...a),
      update: (...a: unknown[]) => invitationUpdateMock(...a),
    },
  },
}));

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/invitations/inv-1", { method: "DELETE" });
}

const params = Promise.resolve({ orgId: "org-1", invitationId: "inv-1" });

describe("/api/orgs/[orgId]/invitations/[invitationId]", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    invitationFindUniqueMock.mockReset();
    invitationUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
    invitationFindUniqueMock.mockResolvedValue({ id: "inv-1", orgId: "org-1", role: "OPERATOR" });
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

    it("403s for a role that can't manage members", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("404s when the invitation doesn't exist", async () => {
      invitationFindUniqueMock.mockResolvedValue(null);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("404s when the invitation belongs to a different org", async () => {
      invitationFindUniqueMock.mockResolvedValue({ id: "inv-1", orgId: "org-2", role: "OPERATOR" });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("403s when a MANAGER tries to revoke an ADMIN invitation (rank ceiling)", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      invitationFindUniqueMock.mockResolvedValue({ id: "inv-1", orgId: "org-1", role: "ADMIN" });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("allows a MANAGER to revoke an OPERATOR invitation", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      invitationFindUniqueMock.mockResolvedValue({ id: "inv-1", orgId: "org-1", role: "OPERATOR" });
      invitationUpdateMock.mockResolvedValue({});
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(200);
    });

    it("revokes the invitation and returns status: revoked", async () => {
      invitationUpdateMock.mockResolvedValue({});
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "revoked" });
      expect(invitationUpdateMock).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
