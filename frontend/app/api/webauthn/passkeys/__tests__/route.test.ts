// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const authenticatorFindManyMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: { authenticator: { findMany: (...a: unknown[]) => authenticatorFindManyMock(...a) } },
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/webauthn/passkeys", { method: "GET" });
}

describe("GET /api/webauthn/passkeys", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset().mockReturnValue(false);
    authenticatorFindManyMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401s when not logged in", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("scopes the query to the current user and selects only safe fields", async () => {
    const rows = [
      {
        id: "auth-1",
        name: "My laptop",
        deviceType: "singleDevice",
        backedUp: false,
        transports: ["internal"],
        createdAt: new Date("2026-01-01"),
        lastUsedAt: null,
      },
    ];
    authenticatorFindManyMock.mockResolvedValue(rows);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(authenticatorFindManyMock).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        transports: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    const selectArg = authenticatorFindManyMock.mock.calls[0][0].select;
    expect(selectArg.credentialId).toBeUndefined();
    expect(selectArg.publicKey).toBeUndefined();
    expect(selectArg.counter).toBeUndefined();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.passkeys).toHaveLength(1);
    expect(json.passkeys[0]).not.toHaveProperty("credentialId");
    expect(json.passkeys[0]).not.toHaveProperty("publicKey");
    expect(json.passkeys[0]).not.toHaveProperty("counter");
  });
});
