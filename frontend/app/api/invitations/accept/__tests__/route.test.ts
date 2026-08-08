// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const bcryptHashMock = vi.fn();
vi.mock("bcryptjs", () => ({ default: { hash: (...a: unknown[]) => bcryptHashMock(...a) } }));

const invitationFindUniqueMock = vi.fn();
const invitationUpdateMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userCreateMock = vi.fn();
const membershipFindUniqueMock = vi.fn();
const membershipCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    invitation: {
      findUnique: (...a: unknown[]) => invitationFindUniqueMock(...a),
      update: (...a: unknown[]) => invitationUpdateMock(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      create: (...a: unknown[]) => userCreateMock(...a),
    },
    membership: {
      findUnique: (...a: unknown[]) => membershipFindUniqueMock(...a),
      create: (...a: unknown[]) => membershipCreateMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makeGetRequest(token: string | null) {
  const url = token !== null
    ? `http://localhost/api/invitations/accept?token=${encodeURIComponent(token)}`
    : "http://localhost/api/invitations/accept";
  return new NextRequest(url);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/invitations/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    email: "invitee@example.com",
    orgId: "org-1",
    role: "OPERATOR",
    consumedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe("/api/invitations/accept", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    authMock.mockReset();
    bcryptHashMock.mockReset();
    bcryptHashMock.mockResolvedValue("hashed-password");
    invitationFindUniqueMock.mockReset();
    invitationUpdateMock.mockReset();
    userFindUniqueMock.mockReset();
    userCreateMock.mockReset();
    membershipFindUniqueMock.mockReset();
    membershipCreateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          user: { create: (...a: unknown[]) => userCreateMock(...a) },
          membership: { create: (...a: unknown[]) => membershipCreateMock(...a) },
          invitation: { update: (...a: unknown[]) => invitationUpdateMock(...a) },
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
      invitationFindUniqueMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("bad-token"));
      expect(res.status).toBe(400);
    });

    it("400s for an already-consumed invitation", async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...validInvitation({}),
        consumedAt: new Date(),
        org: { name: "Org" },
      });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("400s for a revoked invitation", async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...validInvitation({}),
        revokedAt: new Date(),
        org: { name: "Org" },
      });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("400s for an expired invitation", async () => {
      invitationFindUniqueMock.mockResolvedValue({
        ...validInvitation({ expiresAt: new Date(Date.now() - 1000) }),
        org: { name: "Org" },
      });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(400);
    });

    it("returns invitation details with accountExists: true when the email has a user", async () => {
      invitationFindUniqueMock.mockResolvedValue({ ...validInvitation(), org: { name: "Wellington Netball" } });
      userFindUniqueMock.mockResolvedValue({ id: "u1" });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        email: "invitee@example.com",
        orgName: "Wellington Netball",
        role: "OPERATOR",
        accountExists: true,
      });
    });

    it("returns accountExists: false when no user exists for the invited email", async () => {
      invitationFindUniqueMock.mockResolvedValue({ ...validInvitation(), org: { name: "Org" } });
      userFindUniqueMock.mockResolvedValue(null);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest("tok"));
      const body = await res.json();
      expect(body.accountExists).toBe(false);
    });
  });

  describe("POST", () => {
    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok" }));
      expect(res.status).toBe(429);
    });

    it("400s when token is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);
    });

    it("400s on unparseable JSON", async () => {
      const { POST } = await import("../route");
      const req = new NextRequest("http://localhost/api/invitations/accept", { method: "POST", body: "not json" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("400s for an invalid/expired/consumed/revoked invitation", async () => {
      invitationFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ token: "tok" }));
      expect(res.status).toBe(400);
    });

    describe("existing user", () => {
      beforeEach(() => {
        invitationFindUniqueMock.mockResolvedValue(validInvitation());
        userFindUniqueMock.mockResolvedValue({ id: "existing-user" });
      });

      it("401s when not logged in", async () => {
        authMock.mockResolvedValue(null);
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok" }));
        expect(res.status).toBe(401);
      });

      it("401s when logged in as a different user than the invited account", async () => {
        authMock.mockResolvedValue({ user: { id: "someone-else" } });
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok" }));
        expect(res.status).toBe(401);
      });

      it("409s when already a member of the org", async () => {
        authMock.mockResolvedValue({ user: { id: "existing-user" } });
        membershipFindUniqueMock.mockResolvedValue({ userId: "existing-user", orgId: "org-1" });
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok" }));
        expect(res.status).toBe(409);
      });

      it("joins the org via a transaction and marks the invitation consumed", async () => {
        authMock.mockResolvedValue({ user: { id: "existing-user" } });
        membershipFindUniqueMock.mockResolvedValue(null);
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "joined" });
        expect(transactionMock).toHaveBeenCalled();
      });
    });

    describe("new user", () => {
      beforeEach(() => {
        invitationFindUniqueMock.mockResolvedValue(validInvitation());
        userFindUniqueMock.mockResolvedValue(null);
      });

      it("400s when name is missing", async () => {
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok", password: "longenough123" }));
        expect(res.status).toBe(400);
      });

      it("400s when password is missing", async () => {
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok", name: "Ann" }));
        expect(res.status).toBe(400);
      });

      it("400s when password is shorter than 8 characters", async () => {
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok", name: "Ann", password: "short" }));
        expect(res.status).toBe(400);
      });

      it("creates a user + membership and marks the invitation consumed, returning 201", async () => {
        userCreateMock.mockResolvedValue({ id: "new-user" });
        const { POST } = await import("../route");
        const res = await POST(makePostRequest({ token: "tok", name: "  Ann Lee  ", password: "longenough123" }));

        expect(bcryptHashMock).toHaveBeenCalledWith("longenough123", 12);
        expect(userCreateMock).toHaveBeenCalledWith({
          data: { email: "invitee@example.com", passwordHash: "hashed-password", name: "Ann Lee" },
        });
        expect(membershipCreateMock).toHaveBeenCalledWith({
          data: { userId: "new-user", orgId: "org-1", role: "OPERATOR" },
        });
        expect(invitationUpdateMock).toHaveBeenCalledWith({
          where: { id: "inv-1" },
          data: { consumedAt: expect.any(Date) },
        });
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ status: "created" });
      });
    });
  });
});
