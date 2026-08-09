// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const emailChangeRequestFindUniqueMock = vi.fn();
const emailChangeRequestUpdateMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
const transactionMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    emailChangeRequest: {
      findUnique: (...a: unknown[]) => emailChangeRequestFindUniqueMock(...a),
      update: (...a: unknown[]) => emailChangeRequestUpdateMock(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      update: (...a: unknown[]) => userUpdateMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/account/email/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    userId: "u1",
    newEmail: "new@example.com",
    tokenHash: crypto.createHash("sha256").update("good-token").digest("hex"),
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("POST /api/account/email/confirm", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    emailChangeRequestFindUniqueMock.mockReset();
    emailChangeRequestUpdateMock.mockReset();
    userFindUniqueMock.mockReset();
    userUpdateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockResolvedValue([]);
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "good-token" }));
    expect(res.status).toBe(429);
  });

  it("400s when token is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body", async () => {
    const req = new NextRequest("http://localhost/api/account/email/confirm", {
      method: "POST",
      body: "not json",
    });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400s when no matching pending request exists", async () => {
    emailChangeRequestFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "bad-token" }));
    expect(res.status).toBe(400);
  });

  it("400s when the request is already consumed", async () => {
    emailChangeRequestFindUniqueMock.mockResolvedValue(pendingRequest({ consumedAt: new Date() }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "good-token" }));
    expect(res.status).toBe(400);
  });

  it("400s when the request has expired", async () => {
    emailChangeRequestFindUniqueMock.mockResolvedValue(
      pendingRequest({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "good-token" }));
    expect(res.status).toBe(400);
  });

  it("409s when another account already has the new email", async () => {
    emailChangeRequestFindUniqueMock.mockResolvedValue(pendingRequest());
    userFindUniqueMock.mockResolvedValue({ id: "someone-else" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "good-token" }));
    expect(res.status).toBe(409);
  });

  it("applies the email change transactionally and returns ok", async () => {
    const pending = pendingRequest();
    emailChangeRequestFindUniqueMock.mockResolvedValue(pending);
    userFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ token: "good-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
