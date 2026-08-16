// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const bcryptHashMock = vi.fn();
vi.mock("bcryptjs", () => ({ default: { hash: (...a: unknown[]) => bcryptHashMock(...a) } }));

const passwordResetRequestFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
const passwordResetRequestUpdateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    passwordResetRequest: {
      findUnique: (...a: unknown[]) => passwordResetRequestFindUniqueMock(...a),
      update: (...a: unknown[]) => passwordResetRequestUpdateMock(...a),
    },
    user: { update: (...a: unknown[]) => userUpdateMock(...a) },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeGetRequest(token: string | null) {
  const url = token !== null
    ? `http://localhost/api/auth/reset-password?token=${encodeURIComponent(token)}`
    : "http://localhost/api/auth/reset-password";
  return new NextRequest(url);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validResetRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "prr-1",
    userId: "u1",
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("/api/auth/reset-password", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    bcryptHashMock.mockReset();
    bcryptHashMock.mockResolvedValue("hashed-password");
    passwordResetRequestFindUniqueMock.mockReset();
    userUpdateMock.mockReset();
    passwordResetRequestUpdateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : arg
    );
  });

  describe("GET", () => {
    it("400s when token is missing", async () => {
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(null));
      expect(res.status).toBe(400);
    });

    it("400s for an invalid/unknown token", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("bad-token"));
      expect(res.status).toBe(400);
    });

    it("400s for an already-consumed request", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(validResetRequest({ consumedAt: new Date() }));
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("400s for an expired request", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(
        validResetRequest({ expiresAt: new Date(Date.now() - 1000) })
      );
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("returns valid for a good token", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(validResetRequest());
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(200);
    });
  });

  describe("POST", () => {
    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));
      expect(res.status).toBe(429);
    });

    it("400s when password is shorter than 8 characters", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "short" }));
      expect(res.status).toBe(400);
    });

    it("400s for an invalid/expired/consumed request", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));
      expect(res.status).toBe(400);
    });

    it("updates the password and marks the request consumed", async () => {
      passwordResetRequestFindUniqueMock.mockResolvedValue(validResetRequest());
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));

      expect(bcryptHashMock).toHaveBeenCalledWith("longenough", 12);
      expect(userUpdateMock).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { passwordHash: "hashed-password" },
      });
      expect(passwordResetRequestUpdateMock).toHaveBeenCalledWith({
        where: { id: "prr-1" },
        data: { consumedAt: expect.any(Date) },
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    });
  });
});
