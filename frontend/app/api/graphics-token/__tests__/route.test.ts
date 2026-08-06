// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const matchFindUniqueMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: { match: { findUnique: (...a: unknown[]) => matchFindUniqueMock(...a) } },
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: () => false,
  clientIp: () => "127.0.0.1",
}));

describe("GET /api/graphics-token", () => {
  beforeEach(() => {
    matchFindUniqueMock.mockReset();
    authMock.mockReset();
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = "test-secret";
    authMock.mockResolvedValue({
      user: { id: "u1", activeOrgId: "org-1", activeRole: "ADMIN" },
    });
  });

  it("404s when the requested matchId belongs to a different org", async () => {
    matchFindUniqueMock.mockResolvedValue({ orgId: "org-2" });
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/graphics-token?matchId=m1"));
    expect(res.status).toBe(404);
  });

  it("mints a token when the matchId belongs to the caller's org", async () => {
    matchFindUniqueMock.mockResolvedValue({ orgId: "org-1" });
    const { GET } = await import("../route");
    const res = await GET(new NextRequest("http://localhost/api/graphics-token?matchId=m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });
});
