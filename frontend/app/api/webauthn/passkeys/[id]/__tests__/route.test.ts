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

const authenticatorFindUniqueMock = vi.fn();
const authenticatorDeleteMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    authenticator: {
      findUnique: (...a: unknown[]) => authenticatorFindUniqueMock(...a),
      delete: (...a: unknown[]) => authenticatorDeleteMock(...a),
    },
  },
}));

function makeRequest(id: string) {
  const req = new NextRequest(`http://localhost/api/webauthn/passkeys/${id}`, { method: "DELETE" });
  return { req, params: Promise.resolve({ id }) };
}

describe("DELETE /api/webauthn/passkeys/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset().mockReturnValue(false);
    authenticatorFindUniqueMock.mockReset();
    authenticatorDeleteMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401s when not logged in", async () => {
    authMock.mockResolvedValue(null);
    const { DELETE } = await import("../route");
    const { req, params } = makeRequest("auth-1");
    const res = await DELETE(req, { params });
    expect(res.status).toBe(401);
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { DELETE } = await import("../route");
    const { req, params } = makeRequest("auth-1");
    const res = await DELETE(req, { params });
    expect(res.status).toBe(429);
  });

  it("404s when the authenticator doesn't exist", async () => {
    authenticatorFindUniqueMock.mockResolvedValue(null);
    const { DELETE } = await import("../route");
    const { req, params } = makeRequest("missing");
    const res = await DELETE(req, { params });
    expect(res.status).toBe(404);
    expect(authenticatorDeleteMock).not.toHaveBeenCalled();
  });

  it("404s (not 403) when the authenticator belongs to a different user", async () => {
    authenticatorFindUniqueMock.mockResolvedValue({ id: "auth-1", userId: "someone-else" });
    const { DELETE } = await import("../route");
    const { req, params } = makeRequest("auth-1");
    const res = await DELETE(req, { params });
    expect(res.status).toBe(404);
    expect(authenticatorDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes and returns ok when owned by the current user", async () => {
    authenticatorFindUniqueMock.mockResolvedValue({ id: "auth-1", userId: "u1" });
    const { DELETE } = await import("../route");
    const { req, params } = makeRequest("auth-1");
    const res = await DELETE(req, { params });
    expect(authenticatorDeleteMock).toHaveBeenCalledWith({ where: { id: "auth-1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
