// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const membershipFindUniqueMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: { membership: { findUnique: (...a: unknown[]) => membershipFindUniqueMock(...a) } },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/session/switch-org", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/session/switch-org", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    membershipFindUniqueMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401s when not logged in", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ orgId: "org-1" }));
    expect(res.status).toBe(401);
  });

  it("400s when orgId is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body (falls back to {})", async () => {
    const req = new NextRequest("http://localhost/api/session/switch-org", { method: "POST", body: "not json" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("403s when the user has no membership in the target org", async () => {
    membershipFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ orgId: "org-1" }));
    expect(res.status).toBe(403);
  });

  it("200s and re-queries the DB membership (not the JWT) before allowing the switch", async () => {
    membershipFindUniqueMock.mockResolvedValue({ userId: "u1", orgId: "org-1" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ orgId: "org-1" }));
    expect(membershipFindUniqueMock).toHaveBeenCalledWith({
      where: { userId_orgId: { userId: "u1", orgId: "org-1" } },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", orgId: "org-1" });
  });
});
