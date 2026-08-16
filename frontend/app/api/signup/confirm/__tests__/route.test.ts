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

const signupRequestFindUniqueMock = vi.fn();
const signupRequestUpdateMock = vi.fn();
const userFindUniqueMock = vi.fn();
const accountCreateMock = vi.fn();
const orgCreateMock = vi.fn();
const userCreateMock = vi.fn();
const membershipCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    signupRequest: {
      findUnique: (...a: unknown[]) => signupRequestFindUniqueMock(...a),
      update: (...a: unknown[]) => signupRequestUpdateMock(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUniqueMock(...a) },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeGetRequest(token: string | null) {
  const url = token !== null
    ? `http://localhost/api/signup/confirm?token=${encodeURIComponent(token)}`
    : "http://localhost/api/signup/confirm";
  return new NextRequest(url);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/signup/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validSignupRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "sr-1",
    email: "new@example.com",
    name: "Ann Lee",
    orgName: "Wellington Netball",
    termsAcceptedAt: new Date("2026-01-01"),
    termsVersion: "2026-01-01",
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("/api/signup/confirm", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    bcryptHashMock.mockReset();
    bcryptHashMock.mockResolvedValue("hashed-password");
    signupRequestFindUniqueMock.mockReset();
    signupRequestUpdateMock.mockReset();
    userFindUniqueMock.mockReset();
    accountCreateMock.mockReset();
    orgCreateMock.mockReset();
    userCreateMock.mockReset();
    membershipCreateMock.mockReset();
    transactionMock.mockReset();

    accountCreateMock.mockResolvedValue({ id: "acc_1" });
    orgCreateMock.mockResolvedValue({ id: "org_1" });
    userCreateMock.mockResolvedValue({ id: "user_1" });
    membershipCreateMock.mockResolvedValue({});

    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          account: { create: (...a: unknown[]) => accountCreateMock(...a) },
          org: { create: (...a: unknown[]) => orgCreateMock(...a) },
          user: { create: (...a: unknown[]) => userCreateMock(...a) },
          membership: { create: (...a: unknown[]) => membershipCreateMock(...a) },
          signupRequest: { update: (...a: unknown[]) => signupRequestUpdateMock(...a) },
        });
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  describe("GET", () => {
    it("400s when token is missing", async () => {
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(null));
      expect(res.status).toBe(400);
    });

    it("400s for an invalid/unknown token", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("bad-token"));
      expect(res.status).toBe(400);
    });

    it("400s for an already-consumed request", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(validSignupRequest({ consumedAt: new Date() }));
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("400s for an expired request", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(
        validSignupRequest({ expiresAt: new Date(Date.now() - 1000) })
      );
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("returns signup request details", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(validSignupRequest());
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        email: "new@example.com",
        name: "Ann Lee",
        orgName: "Wellington Netball",
      });
    });
  });

  describe("POST", () => {
    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));
      expect(res.status).toBe(429);
    });

    it("400s when token is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ password: "longenough" }));
      expect(res.status).toBe(400);
    });

    it("400s when password is shorter than 8 characters", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "short" }));
      expect(res.status).toBe(400);
    });

    it("400s for an invalid/expired/consumed request", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));
      expect(res.status).toBe(400);
    });

    it("409s when a user with that email already exists", async () => {
      signupRequestFindUniqueMock.mockResolvedValue(validSignupRequest());
      userFindUniqueMock.mockResolvedValue({ id: "existing" });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));
      expect(res.status).toBe(409);
    });

    it("creates account/org/user/membership, marks the request consumed, and returns 201", async () => {
      const signupRequest = validSignupRequest();
      signupRequestFindUniqueMock.mockResolvedValue(signupRequest);
      userFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok", password: "longenough" }));

      expect(bcryptHashMock).toHaveBeenCalledWith("longenough", 12);
      expect(accountCreateMock).toHaveBeenCalledWith({ data: { name: "Wellington Netball" } });
      expect(orgCreateMock).toHaveBeenCalledWith({ data: { accountId: "acc_1", name: "Wellington Netball" } });
      expect(userCreateMock).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          passwordHash: "hashed-password",
          name: "Ann Lee",
          termsAcceptedAt: signupRequest.termsAcceptedAt,
          termsVersion: signupRequest.termsVersion,
        },
      });
      expect(membershipCreateMock).toHaveBeenCalledWith({
        data: { userId: "user_1", orgId: "org_1", role: "ADMIN" },
      });
      expect(signupRequestUpdateMock).toHaveBeenCalledWith({
        where: { id: "sr-1" },
        data: { consumedAt: expect.any(Date) },
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ status: "created" });
    });
  });
});
