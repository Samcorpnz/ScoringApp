// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findUniqueMock = vi.fn();
vi.mock("@scorehub/db", () => ({ prisma: { match: { findUnique: (...a: unknown[]) => findUniqueMock(...a) } } }));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const isRateLimitedMock = vi.fn((_key: string, _limit: number, _windowMs: number) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (key: string, limit: number, windowMs: number) => isRateLimitedMock(key, limit, windowMs),
  clientIp: () => "127.0.0.1",
}));

describe("GET /api/control-token", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    authMock.mockReset();
    isRateLimitedMock.mockClear();
    process.env.AUTH_SECRET = "test-secret";
    authMock.mockResolvedValue({
      user: { id: "u1", activeOrgId: "org-1", activeRole: "ADMIN" },
    });
  });

  it("rate-limits with enough headroom for rapid legitimate bursts (SA-102 follow-up)", async () => {
    // This route is fetched on every /control or /setup mount and again on
    // every matchId change — a tight limit here can trip on ordinary rapid
    // match creation, not just abuse. 30/60s was tight enough to do exactly
    // that; assert the ceiling stays generous rather than silently regressing.
    findUniqueMock.mockResolvedValue({ orgId: "org-1" });
    const { GET } = await import("../route");
    await GET(new NextRequest("http://localhost/api/control-token?matchId=m1"));
    expect(isRateLimitedMock).toHaveBeenCalledWith("control-token:127.0.0.1", expect.any(Number), 60_000);
    const limit = isRateLimitedMock.mock.calls[0][1];
    expect(limit).toBeGreaterThanOrEqual(120);
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
