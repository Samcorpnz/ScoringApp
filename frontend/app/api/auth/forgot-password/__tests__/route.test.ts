// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const verifyTurnstileTokenMock = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...a: unknown[]) => verifyTurnstileTokenMock(...a),
}));

const sendPasswordResetEmailMock = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmailMock(...a),
}));

const userFindUniqueMock = vi.fn();
const passwordResetRequestDeleteManyMock = vi.fn();
const passwordResetRequestCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUniqueMock(...a) },
    passwordResetRequest: {
      deleteMany: (...a: unknown[]) => passwordResetRequestDeleteManyMock(...a),
      create: (...a: unknown[]) => passwordResetRequestCreateMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    verifyTurnstileTokenMock.mockReset();
    verifyTurnstileTokenMock.mockResolvedValue(true);
    sendPasswordResetEmailMock.mockReset();
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
    userFindUniqueMock.mockReset();
    passwordResetRequestDeleteManyMock.mockReset();
    passwordResetRequestCreateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : arg
    );
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ email: "a@example.com" }));
    expect(res.status).toBe(429);
  });

  it("400s when email is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400s when turnstile verification fails", async () => {
    verifyTurnstileTokenMock.mockResolvedValue(false);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ email: "a@example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns a generic success response without sending email when no user matches", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("creates a reset request and sends the email when a user matches", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "u1", email: "a@example.com" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ email: "A@Example.com" }));

    expect(passwordResetRequestDeleteManyMock).toHaveBeenCalledWith({
      where: { userId: "u1", consumedAt: null },
    });
    expect(passwordResetRequestCreateMock).toHaveBeenCalledWith({
      data: { userId: "u1", tokenHash: expect.any(String), expiresAt: expect.any(Date) },
    });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({ to: "a@example.com", token: expect.any(String) });
    expect(res.status).toBe(200);
  });

  it("returns the raw token instead of emailing it when E2E_EXPOSE_AUTH_TOKENS=true", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "u1", email: "a@example.com" });
    process.env.E2E_EXPOSE_AUTH_TOKENS = "true";
    try {
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ email: "a@example.com" }));
      const json = await res.json();
      expect(json).toEqual({ status: "if that account exists, we've sent an email", token: expect.any(String) });
      expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_EXPOSE_AUTH_TOKENS;
    }
  });
});
