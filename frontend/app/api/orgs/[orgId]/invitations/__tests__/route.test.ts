// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({ isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a) }));

const sendInvitationEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({ sendInvitationEmail: (...a: unknown[]) => sendInvitationEmailMock(...a) }));

const orgFindUniqueMock = vi.fn();
const userFindUniqueMock = vi.fn();
const invitationFindManyMock = vi.fn();
const invitationDeleteManyMock = vi.fn();
const invitationCreateMock = vi.fn();
const transactionMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    org: { findUnique: (...a: unknown[]) => orgFindUniqueMock(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUniqueMock(...a) },
    invitation: {
      findMany: (...a: unknown[]) => invitationFindManyMock(...a),
      deleteMany: (...a: unknown[]) => invitationDeleteManyMock(...a),
      create: (...a: unknown[]) => invitationCreateMock(...a),
    },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/orgs/org-1/invitations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/orgs/org-1/invitations");
}

const params = Promise.resolve({ orgId: "org-1" });

describe("/api/orgs/[orgId]/invitations", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    sendInvitationEmailMock.mockReset();
    orgFindUniqueMock.mockReset();
    userFindUniqueMock.mockReset();
    invitationFindManyMock.mockReset();
    invitationDeleteManyMock.mockReset();
    invitationDeleteManyMock.mockReturnValue("deleteMany-promise");
    invitationCreateMock.mockReset();
    invitationCreateMock.mockReturnValue("create-promise");
    transactionMock.mockReset();
    transactionMock.mockResolvedValue([]);
    authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-1", activeRole: "ADMIN" } });
  });

  describe("POST", () => {
    it("401s when there's no session/activeOrgId mismatch", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role that can't manage members", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-1", activeRole: "OPERATOR" } });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(403);
    });

    it("429s when rate-limited", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(429);
    });

    it("400s when email is missing", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ role: "OPERATOR" }), { params });
      expect(res.status).toBe(400);
    });

    it("400s for an invalid role", async () => {
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "SUPERADMIN" }), { params });
      expect(res.status).toBe(400);
    });

    it("400s on unparseable JSON", async () => {
      const { POST } = await import("../route");
      const req = new NextRequest("http://localhost/api/orgs/org-1/invitations", { method: "POST", body: "not json" });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });

    it("403s when a MANAGER tries to invite an ADMIN (rank escalation)", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-1", activeRole: "MANAGER" } });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "ADMIN" }), { params });
      expect(res.status).toBe(403);
    });

    it("allows a MANAGER to invite an OPERATOR", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-1", activeRole: "MANAGER" } });
      orgFindUniqueMock.mockResolvedValue({ id: "org-1", name: "Org" });
      userFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(201);
    });

    it("404s when the org doesn't exist", async () => {
      orgFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(404);
    });

    it("409s when the invited email already belongs to a member of this org", async () => {
      orgFindUniqueMock.mockResolvedValue({ id: "org-1", name: "Org" });
      userFindUniqueMock.mockResolvedValue({ id: "u2", memberships: [{ orgId: "org-1" }] });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "existing@example.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(409);
    });

    it("allows re-inviting an email that has an account but no membership in this org", async () => {
      orgFindUniqueMock.mockResolvedValue({ id: "org-1", name: "Org" });
      userFindUniqueMock.mockResolvedValue({ id: "u2", memberships: [] });
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "other-org-user@example.com", role: "OPERATOR" }), { params });
      expect(res.status).toBe(201);
    });

    it("lowercases and trims the email before lookups", async () => {
      orgFindUniqueMock.mockResolvedValue({ id: "org-1", name: "Org" });
      userFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      await POST(makePostRequest({ email: "  Mixed@Example.com  ", role: "OPERATOR" }), { params });
      expect(userFindUniqueMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "mixed@example.com" } }),
      );
    });

    it("creates the invitation via a transaction, deleting any existing pending one first", async () => {
      orgFindUniqueMock.mockResolvedValue({ id: "org-1", name: "Wellington Netball" });
      userFindUniqueMock.mockResolvedValue(null);
      const { POST } = await import("../route");
      const res = await POST(makePostRequest({ email: "a@b.com", role: "OPERATOR" }), { params });

      expect(transactionMock).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
      ]);
      expect(sendInvitationEmailMock).toHaveBeenCalledWith({
        to: "a@b.com",
        orgName: "Wellington Netball",
        role: "OPERATOR",
        token: expect.any(String),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ status: "sent" });
    });
  });

  describe("GET", () => {
    it("401s on activeOrgId mismatch", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-2", activeRole: "ADMIN" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(401);
    });

    it("403s for a role that can't manage members", async () => {
      authMock.mockResolvedValue({ user: { id: "u1", activeOrgId: "org-1", activeRole: "VIEWER" } });
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(403);
    });

    it("returns pending invitations for the org", async () => {
      const invitations = [{ id: "inv-1", email: "a@b.com", role: "OPERATOR" }];
      invitationFindManyMock.mockResolvedValue(invitations);
      const { GET } = await import("../route");
      const res = await GET(makeGetRequest(), { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ invitations });
      expect(invitationFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) }),
      );
    });
  });
});
