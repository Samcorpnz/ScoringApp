// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findUniqueMock = vi.fn();
vi.mock("@scorehub/db", () => ({ prisma: { match: { findUnique: (...a: unknown[]) => findUniqueMock(...a) } } }));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: () => false,
  clientIp: () => "127.0.0.1",
}));

describe("GET /api/control-token", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    authMock.mockReset();
    process.env.AUTH_SECRET = "test-secret";
    authMock.mockResolvedValue({
      user: { id: "u1", activeOrgId: "org-1", activeRole: "ADMIN" },
    });
  });

  it("404s when the requested matchId belongs to a different org", async () => {
    findUniqueMock.mockResolvedValue({ orgId: "org-2" });
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/control-token?matchId=m1"));
    expect(res.status).toBe(404);
  });

  it("404s when the requested matchId doesn't exist at all", async () => {
    findUniqueMock.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/control-token?matchId=m1"));
    expect(res.status).toBe(404);
  });

  it("mints a token when the matchId belongs to the caller's org", async () => {
    findUniqueMock.mockResolvedValue({ orgId: "org-1" });
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/control-token?matchId=m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });
});
