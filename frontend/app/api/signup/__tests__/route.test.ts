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

const userFindUniqueMock = vi.fn();
const transactionMock = vi.fn();
const accountCreateMock = vi.fn();
const orgCreateMock = vi.fn();
const userCreateMock = vi.fn();
const membershipCreateMock = vi.fn();

vi.mock("@scorehub/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUniqueMock(...a) },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
  Prisma: {},
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "New@Example.com",
  password: "longenough1",
  name: "Ann Lee",
  orgName: "Wellington Netball",
};

describe("POST /api/signup", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset();
    isRateLimitedMock.mockReturnValue(false);
    bcryptHashMock.mockReset();
    bcryptHashMock.mockResolvedValue("hashed-password");
    userFindUniqueMock.mockReset();
    transactionMock.mockReset();
    accountCreateMock.mockReset();
    orgCreateMock.mockReset();
    userCreateMock.mockReset();
    membershipCreateMock.mockReset();

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
        });
      }
      return Promise.all(arg as Promise<unknown>[]);
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

  it("400s when password is missing", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, password: "" }));
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

  it("400s when password is shorter than 8 characters", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("400s on unparseable JSON body", async () => {
    const req = new NextRequest("http://localhost/api/signup", { method: "POST", body: "not json" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("409s when an account with that email already exists", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "existing" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it("creates account/org/user/membership in a transaction and returns 201", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest(validBody));

    expect(userFindUniqueMock).toHaveBeenCalledWith({ where: { email: "new@example.com" } });
    expect(bcryptHashMock).toHaveBeenCalledWith("longenough1", 12);
    expect(accountCreateMock).toHaveBeenCalledWith({ data: { name: "Wellington Netball" } });
    expect(orgCreateMock).toHaveBeenCalledWith({ data: { accountId: "acc_1", name: "Wellington Netball" } });
    expect(userCreateMock).toHaveBeenCalledWith({
      data: { email: "new@example.com", passwordHash: "hashed-password", name: "Ann Lee" },
    });
    expect(membershipCreateMock).toHaveBeenCalledWith({
      data: { userId: "user_1", orgId: "org_1", role: "ADMIN" },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
