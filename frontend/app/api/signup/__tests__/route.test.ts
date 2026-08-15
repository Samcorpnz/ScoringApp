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

const sendSignupVerificationEmailMock = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/email", () => ({
  sendSignupVerificationEmail: (...a: unknown[]) => sendSignupVerificationEmailMock(...a),
}));

const userFindUniqueMock = vi.fn();
const signupRequestDeleteManyMock = vi.fn();
const signupRequestCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUniqueMock(...a) },
    signupRequest: {
      deleteMany: (...a: unknown[]) => signupRequestDeleteManyMock(...a),
      create: (...a: unknown[]) => signupRequestCreateMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "New@Example.com",
  name: "Ann Lee",
  orgName: "Wellington Netball",
  acceptedTerms: true,
  turnstileToken: "tok",
};

describe("POST /api/signup", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    verifyTurnstileTokenMock.mockReset();
    verifyTurnstileTokenMock.mockResolvedValue(true);
    sendSignupVerificationEmailMock.mockReset();
    sendSignupVerificationEmailMock.mockResolvedValue(undefined);
    userFindUniqueMock.mockReset();
    userFindUniqueMock.mockResolvedValue(null);
    signupRequestDeleteManyMock.mockReset();
    signupRequestCreateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return arg;
    });
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("400s when email is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, email: "" }));
    expect(res.status).toBe(400);
  });

  it("400s when name is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, name: "" }));
    expect(res.status).toBe(400);
  });

  it("400s when orgName is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, orgName: "" }));
    expect(res.status).toBe(400);
  });

  it("400s when terms are not accepted", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, acceptedTerms: false }));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body", async () => {
    const req = new NextRequest("http://localhost/api/signup", { method: "POST", body: "not json" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400s when turnstile verification fails", async () => {
    verifyTurnstileTokenMock.mockResolvedValue(false);
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
  });

  it("409s when an account with that email already exists", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "existing" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it("creates a signup request, sends the verification email, and returns 201", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));

    expect(userFindUniqueMock).toHaveBeenCalledWith({ where: { email: "new@example.com" } });
    expect(signupRequestDeleteManyMock).toHaveBeenCalledWith({
      where: { email: "new@example.com", consumedAt: null },
    });
    expect(signupRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        name: "Ann Lee",
        orgName: "Wellington Netball",
        tokenHash: expect.any(String),
        termsAcceptedAt: expect.any(Date),
        termsVersion: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(sendSignupVerificationEmailMock).toHaveBeenCalledWith({
      to: "new@example.com",
      name: "Ann Lee",
      token: expect.any(String),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: "check your email" });
  });

  it("returns the raw token instead of emailing it when E2E_EXPOSE_AUTH_TOKENS=true", async () => {
    process.env.E2E_EXPOSE_AUTH_TOKENS = "true";
    try {
      const { POST } = await import("../route");
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(json).toEqual({ status: "check your email", token: expect.any(String) });
      expect(sendSignupVerificationEmailMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_EXPOSE_AUTH_TOKENS;
    }
  });
});
