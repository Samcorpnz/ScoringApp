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
const bcryptHashMock = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...a: unknown[]) => bcryptCompareMock(...a),
    hash: (...a: unknown[]) => bcryptHashMock(...a),
  },
}));

const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      update: (...a: unknown[]) => userUpdateMock(...a),
    },
  },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/account/password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/password", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    bcryptCompareMock.mockReset();
    bcryptHashMock.mockReset();
    bcryptHashMock.mockResolvedValue("new-hash");
    userFindUniqueMock.mockReset();
    userUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401s when not logged in", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "longenough1" }));
    expect(res.status).toBe(401);
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "longenough1" }));
    expect(res.status).toBe(429);
  });

  it("400s when currentPassword is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ newPassword: "longenough1" }));
    expect(res.status).toBe(400);
  });

  it("400s when newPassword is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old" }));
    expect(res.status).toBe(400);
  });

  it("400s when newPassword is shorter than 8 characters", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "short" }));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body", async () => {
    const req = new NextRequest("http://localhost/api/account/password", { method: "POST", body: "not json" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("401s when the session user can't be found", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "longenough1" }));
    expect(res.status).toBe(401);
  });

  it("401s when currentPassword is incorrect", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "u1", passwordHash: "hash" });
    bcryptCompareMock.mockResolvedValue(false);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "wrong", newPassword: "longenough1" }));
    expect(res.status).toBe(401);
  });

  it("hashes and updates the password on success", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "u1", passwordHash: "hash" });
    bcryptCompareMock.mockResolvedValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ currentPassword: "old", newPassword: "longenough1" }));
    expect(bcryptHashMock).toHaveBeenCalledWith("longenough1", 12);
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { passwordHash: "new-hash" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
