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

const userUpdateMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: { user: { update: (...a: unknown[]) => userUpdateMock(...a) } },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/account/name", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/account/name", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    userUpdateMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("401s when not logged in", async () => {
    authMock.mockResolvedValue(null);
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Ann" }));
    expect(res.status).toBe(401);
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Ann" }));
    expect(res.status).toBe(429);
  });

  it("400s when name is missing", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("400s when name is only whitespace", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "   " }));
    expect(res.status).toBe(400);
  });

  it("400s when name exceeds 100 characters", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "A".repeat(101) }));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body", async () => {
    const req = new NextRequest("http://localhost/api/account/name", { method: "PATCH", body: "not json" });
    const { PATCH } = await import("../route");
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("trims and updates the name, returning it", async () => {
    userUpdateMock.mockResolvedValue({});
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "  Ann Lee  " }));
    expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ann Lee" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", name: "Ann Lee" });
  });
});
