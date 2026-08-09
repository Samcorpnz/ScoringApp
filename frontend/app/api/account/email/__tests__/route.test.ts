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

const bcryptCompareMock = vi.fn();
vi.mock("bcryptjs", () => ({ default: { compare: (...a: unknown[]) => bcryptCompareMock(...a) } }));

const emailChangeRequestFindFirstMock = vi.fn();
const emailChangeRequestDeleteManyMock = vi.fn();
const emailChangeRequestCreateMock = vi.fn();
const userFindUniqueMock = vi.fn();
const transactionMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    emailChangeRequest: {
      findFirst: (...a: unknown[]) => emailChangeRequestFindFirstMock(...a),
      deleteMany: (...a: unknown[]) => emailChangeRequestDeleteManyMock(...a),
      create: (...a: unknown[]) => emailChangeRequestCreateMock(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

const sendEmailChangeVerificationMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmailChangeVerification: (...a: unknown[]) => sendEmailChangeVerificationMock(...a),
}));

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/account/email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/account/email", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    bcryptCompareMock.mockReset();
    emailChangeRequestFindFirstMock.mockReset();
    emailChangeRequestDeleteManyMock.mockReset();
    emailChangeRequestCreateMock.mockReset();
    userFindUniqueMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockResolvedValue([]);
    sendEmailChangeVerificationMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  describe("GET", () => {
    it("401s when not logged in", async () => {
      authMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { GET } = await import("../route");
      const res = await GET();
      expect(res.status).toBe(429);
    });

    it("returns pending: null when there's no pending request", async () => {
      emailChangeRequestFindFirstMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET();
      expect(await res.json()).toEqual({ pending: null });
    });

    it("returns the pending new email when a request exists", async () => {
      emailChangeRequestFindFirstMock.mockResolvedValue({ newEmail: "new@example.com" });
      const { GET } = await import("../route");
      const res = await GET();
      expect(await res.json()).toEqual({ pending: "new@example.com" });
    });
  });

  describe("POST", () => {
    it("401s when not logged in", async () => {
      authMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com", currentPassword: "pw" }));
      expect(res.status).toBe(401);
    });

    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com", currentPassword: "pw" }));
      expect(res.status).toBe(429);
    });

    it("400s when newEmail is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ currentPassword: "pw" }));
      expect(res.status).toBe(400);
    });

    it("400s when currentPassword is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com" }));
      expect(res.status).toBe(400);
    });

    it("400s on unparseable JSON body", async () => {
      const req = new NextRequest("http://localhost/api/account/email", { method: "POST", body: "not json" });
      const { POST } = await import("../route");
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("401s when the session user can't be found", async () => {
      userFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com", currentPassword: "pw" }));
      expect(res.status).toBe(401);
    });

    it("401s when currentPassword is incorrect", async () => {
      userFindUniqueMock.mockResolvedValue({ id: "u1", email: "old@example.com", passwordHash: "hash" });
      bcryptCompareMock.mockResolvedValue(false);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com", currentPassword: "wrong" }));
      expect(res.status).toBe(401);
    });

    it("400s when newEmail matches the current email", async () => {
      userFindUniqueMock.mockResolvedValue({ id: "u1", email: "same@example.com", passwordHash: "hash" });
      bcryptCompareMock.mockResolvedValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "same@example.com", currentPassword: "pw" }));
      expect(res.status).toBe(400);
    });

    it("409s when another account already uses the new email", async () => {
      userFindUniqueMock.mockResolvedValueOnce({ id: "u1", email: "old@example.com", passwordHash: "hash" });
      bcryptCompareMock.mockResolvedValue(true);
      userFindUniqueMock.mockResolvedValueOnce({ id: "u2" });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "taken@example.com", currentPassword: "pw" }));
      expect(res.status).toBe(409);
    });

    it("creates the pending request, sends the verification email, and returns pending status", async () => {
      userFindUniqueMock.mockResolvedValueOnce({ id: "u1", email: "old@example.com", passwordHash: "hash" });
      bcryptCompareMock.mockResolvedValue(true);
      userFindUniqueMock.mockResolvedValueOnce(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ newEmail: "new@example.com", currentPassword: "pw" }));
      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(sendEmailChangeVerificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: "new@example.com" }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "pending", newEmail: "new@example.com" });
    });
  });
});
