// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const matchFindUniqueMock = vi.fn();
const matchUpdateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    match: {
      findUnique: (...a: unknown[]) => matchFindUniqueMock(...a),
      update: (...a: unknown[]) => matchUpdateMock(...a),
    },
  },
}));

function makePostRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/matches/m1/rotate-display-token", { method: "POST" });
}

const params = Promise.resolve({ orgId: "org-1", matchId: "m1" });

describe("/api/orgs/[orgId]/matches/[matchId]/rotate-display-token", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    matchFindUniqueMock.mockReset();
    matchUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "ADMIN" } });
    matchFindUniqueMock.mockResolvedValue({ orgId: "org-1" });
  });

  describe("POST", () => {
    it("401s when there's no session", async () => {
      authMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("401s when the session's activeOrgId doesn't match the route param", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role outside ADMIN/MANAGER", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("allows MANAGER to rotate the token", async () => {
      authMock.mockResolvedValue({ user: { activeOrgId: "org-1", activeRole: "MANAGER" } });
      matchUpdateMock.mockResolvedValue({});
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(200);
    });

    it("404s when the match doesn't exist", async () => {
      matchFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("404s when the match belongs to a different org", async () => {
      matchFindUniqueMock.mockResolvedValue({ orgId: "org-2" });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(404);
    });

    it("generates a fresh 48-char hex token, persists it, and returns it", async () => {
      matchUpdateMock.mockResolvedValue({});
      const { POST } = await import("../route");
      const res = await POST(makePostRequest(), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.displayToken).toMatch(/^[0-9a-f]{48}$/);
      expect(matchUpdateMock).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { displayToken: body.displayToken },
      });
    });
  });
});
