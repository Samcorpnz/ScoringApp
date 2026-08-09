// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const membershipFindUniqueMock = vi.fn();
const membershipUpdateMock = vi.fn();
const membershipDeleteMock = vi.fn();
const membershipCountMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    membership: {
      findUnique: (...a: unknown[]) => membershipFindUniqueMock(...a),
      update: (...a: unknown[]) => membershipUpdateMock(...a),
      delete: (...a: unknown[]) => membershipDeleteMock(...a),
      count: (...a: unknown[]) => membershipCountMock(...a),
    },
  },
  Role: {},
}));

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orgs/org-1/members/u2", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/members/u2", { method: "DELETE" });
}

const params = Promise.resolve({ orgId: "org-1", userId: "u2" });

describe("/api/orgs/[orgId]/members/[userId]", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    membershipFindUniqueMock.mockReset();
    membershipUpdateMock.mockReset();
    membershipDeleteMock.mockReset();
    membershipCountMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
    membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "OPERATOR" });
    membershipCountMock.mockResolvedValue(2);
  });

  describe("PATCH", () => {
    it("401s when there's no session", async () => {
      authMock.mockResolvedValue(null);
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "MANAGER" }), { params });
      expect(res.status).toBe(401);
    });

    it("401s when the session's activeOrgId doesn't match the route param", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "MANAGER" }), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role that can't manage members", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "MANAGER" }), { params });
      expect(res.status).toBe(403);
    });

    it("400s when role is missing", async () => {
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({}), { params });
      expect(res.status).toBe(400);
    });

    it("400s for an invalid role value", async () => {
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "SUPERADMIN" }), { params });
      expect(res.status).toBe(400);
    });

    it("400s on unparseable JSON", async () => {
      const { PATCH } = await import("../route");
      const req = new NextRequest("http://localhost/api/orgs/org-1/members/u2", { method: "PATCH", body: "not json" });
      const res = await PATCH(req, { params });
      expect(res.status).toBe(400);
    });

    it("404s when the membership doesn't exist", async () => {
      membershipFindUniqueMock.mockResolvedValue(null);
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "MANAGER" }), { params });
      expect(res.status).toBe(404);
    });

    it("403s when a MANAGER targets a member who is currently ADMIN/MANAGER", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "MANAGER" });
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "OPERATOR" }), { params });
      expect(res.status).toBe(403);
    });

    it("403s when a MANAGER tries to promote someone to ADMIN", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "OPERATOR" });
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "ADMIN" }), { params });
      expect(res.status).toBe(403);
    });

    it("409s when demoting the org's last ADMIN", async () => {
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "ADMIN" });
      membershipCountMock.mockResolvedValue(0);
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "OPERATOR" }), { params });
      expect(res.status).toBe(409);
    });

    it("allows demoting an ADMIN when other admins remain", async () => {
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "ADMIN" });
      membershipCountMock.mockResolvedValue(1);
      membershipUpdateMock.mockResolvedValue({});
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "OPERATOR" }), { params });
      expect(res.status).toBe(200);
    });

    it("updates the member's role and returns status: ok", async () => {
      membershipUpdateMock.mockResolvedValue({});
      const { PATCH } = await import("../route");
      const res = await PATCH(makePatchRequest({ role: "MANAGER" }), { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
      expect(membershipUpdateMock).toHaveBeenCalledWith({
        where: { userId_orgId: { userId: "u2", orgId: "org-1" } },
        data: { role: "MANAGER" },
      });
    });
  });

  describe("DELETE", () => {
    it("401s when there's no session", async () => {
      authMock.mockResolvedValue(null);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role that can't manage members", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "VIEWER" } });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("404s when the membership doesn't exist", async () => {
      membershipFindUniqueMock.mockResolvedValue(null);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("403s when a MANAGER tries to remove an ADMIN", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "ADMIN" });
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("409s when removing the org's last ADMIN", async () => {
      membershipFindUniqueMock.mockResolvedValue({ userId: "u2", orgId: "org-1", role: "ADMIN" });
      membershipCountMock.mockResolvedValue(0);
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(409);
    });

    it("removes the member and returns status: removed", async () => {
      membershipDeleteMock.mockResolvedValue({});
      const { DELETE } = await import("../route");
      const res = await DELETE(makeDeleteRequest(), { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "removed" });
      expect(membershipDeleteMock).toHaveBeenCalledWith({
        where: { userId_orgId: { userId: "u2", orgId: "org-1" } },
      });
    });
  });
});
