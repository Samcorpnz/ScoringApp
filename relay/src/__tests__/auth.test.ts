import { SignJWT } from "jose";

const findUniqueMock = jest.fn();
jest.mock("@scorehub/db", () => ({
  prisma: { scopedToken: { findUnique: (...a: unknown[]) => findUniqueMock(...a) } },
}));

import {
  LEGACY_ROOM_ID,
  verifyBridgeSecret,
  verifyActionSecret,
  verifyControlSecret,
  verifyGraphicsSecret,
} from "../auth";

const LEGACY_SECRET = "legacy-shared-secret";

async function signControlJwt(payload: Record<string, unknown>, secret = "test-auth-secret") {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject((payload.sub as string) ?? "user-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

describe("relay auth (legacy mode, no DATABASE_URL)", () => {
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    findUniqueMock.mockReset();
  });

  afterAll(() => {
    if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
  });

  it.each([
    ["verifyBridgeSecret", verifyBridgeSecret],
    ["verifyActionSecret", verifyActionSecret],
    ["verifyControlSecret", verifyControlSecret],
    ["verifyGraphicsSecret", verifyGraphicsSecret],
  ])("%s returns the legacy room for a matching secret", async (_name, fn) => {
    await expect(fn(LEGACY_SECRET, LEGACY_SECRET)).resolves.toEqual({ orgId: LEGACY_ROOM_ID });
  });

  it.each([
    ["verifyBridgeSecret", verifyBridgeSecret],
    ["verifyActionSecret", verifyActionSecret],
    ["verifyControlSecret", verifyControlSecret],
    ["verifyGraphicsSecret", verifyGraphicsSecret],
  ])("%s returns null for a non-matching secret", async (_name, fn) => {
    await expect(fn("wrong-secret", LEGACY_SECRET)).resolves.toBeNull();
  });

  it.each([
    ["verifyBridgeSecret", verifyBridgeSecret],
    ["verifyActionSecret", verifyActionSecret],
    ["verifyControlSecret", verifyControlSecret],
    ["verifyGraphicsSecret", verifyGraphicsSecret],
  ])("%s returns null when no secret is supplied", async (_name, fn) => {
    await expect(fn(undefined, LEGACY_SECRET)).resolves.toBeNull();
  });

  it("never touches the DB in legacy mode", async () => {
    await verifyBridgeSecret(LEGACY_SECRET, LEGACY_SECRET);
    await verifyActionSecret(LEGACY_SECRET, LEGACY_SECRET);
    await verifyControlSecret(LEGACY_SECRET, LEGACY_SECRET);
    await verifyGraphicsSecret(LEGACY_SECRET, LEGACY_SECRET);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("relay auth (multi-tenant mode, DATABASE_URL set)", () => {
  const originalDbUrl = process.env.DATABASE_URL;
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test";
    process.env.AUTH_SECRET = "test-auth-secret";
    findUniqueMock.mockReset();
  });

  afterAll(() => {
    if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
    else delete process.env.DATABASE_URL;
    if (originalAuthSecret) process.env.AUTH_SECRET = originalAuthSecret;
    else delete process.env.AUTH_SECRET;
  });

  describe("verifyBridgeSecret", () => {
    it("resolves for a valid, unrevoked BRIDGE token", async () => {
      findUniqueMock.mockResolvedValue({ type: "BRIDGE", orgId: "org-1", matchId: "m1", revokedAt: null });
      await expect(verifyBridgeSecret("tok", "legacy")).resolves.toEqual({ orgId: "org-1", matchId: "m1" });
    });

    it("returns null for a revoked BRIDGE token", async () => {
      findUniqueMock.mockResolvedValue({ type: "BRIDGE", orgId: "org-1", revokedAt: new Date() });
      await expect(verifyBridgeSecret("tok", "legacy")).resolves.toBeNull();
    });

    it("returns null for a token of the wrong type", async () => {
      findUniqueMock.mockResolvedValue({ type: "CONTROL", orgId: "org-1", revokedAt: null });
      await expect(verifyBridgeSecret("tok", "legacy")).resolves.toBeNull();
    });

    it("returns null when the token doesn't exist", async () => {
      findUniqueMock.mockResolvedValue(null);
      await expect(verifyBridgeSecret("tok", "legacy")).resolves.toBeNull();
    });

    it("omits matchId when the token has none", async () => {
      findUniqueMock.mockResolvedValue({ type: "BRIDGE", orgId: "org-1", matchId: null, revokedAt: null });
      await expect(verifyBridgeSecret("tok", "legacy")).resolves.toEqual({ orgId: "org-1", matchId: undefined });
    });
  });

  describe("verifyActionSecret", () => {
    it("accepts a valid CONTROL ScopedToken", async () => {
      findUniqueMock.mockResolvedValue({ type: "CONTROL", orgId: "org-1", matchId: "m1", revokedAt: null });
      await expect(verifyActionSecret("tok", "legacy")).resolves.toEqual({ orgId: "org-1", matchId: "m1" });
    });

    it("falls back to control JWT verification when no CONTROL token matches", async () => {
      findUniqueMock.mockResolvedValue(null);
      const jwt = await signControlJwt({ orgId: "org-1", role: "ADMIN" });
      await expect(verifyActionSecret(jwt, "legacy")).resolves.toEqual({
        orgId: "org-1",
        matchId: undefined,
        userId: "user-1",
      });
    });

    it("returns null when a revoked CONTROL token also fails JWT verification", async () => {
      findUniqueMock.mockResolvedValue({ type: "CONTROL", orgId: "org-1", revokedAt: new Date() });
      await expect(verifyActionSecret("not-a-jwt", "legacy")).resolves.toBeNull();
    });
  });

  describe("verifyControlSecret", () => {
    it("accepts a valid control JWT with ADMIN role", async () => {
      const jwt = await signControlJwt({ orgId: "org-1", role: "ADMIN", matchId: "m1" });
      await expect(verifyControlSecret(jwt, "legacy")).resolves.toEqual({
        orgId: "org-1",
        matchId: "m1",
        userId: "user-1",
      });
    });

    it("accepts MANAGER and OPERATOR roles", async () => {
      const managerJwt = await signControlJwt({ orgId: "org-1", role: "MANAGER" });
      await expect(verifyControlSecret(managerJwt, "legacy")).resolves.toMatchObject({ orgId: "org-1" });

      const operatorJwt = await signControlJwt({ orgId: "org-1", role: "OPERATOR" });
      await expect(verifyControlSecret(operatorJwt, "legacy")).resolves.toMatchObject({ orgId: "org-1" });
    });

    it("rejects an unrecognized role", async () => {
      const jwt = await signControlJwt({ orgId: "org-1", role: "VIEWER" });
      await expect(verifyControlSecret(jwt, "legacy")).resolves.toBeNull();
    });

    it("rejects a JWT missing orgId", async () => {
      const jwt = await signControlJwt({ role: "ADMIN" });
      await expect(verifyControlSecret(jwt, "legacy")).resolves.toBeNull();
    });

    it("rejects a JWT signed with the wrong secret", async () => {
      const jwt = await signControlJwt({ orgId: "org-1", role: "ADMIN" }, "wrong-secret");
      await expect(verifyControlSecret(jwt, "legacy")).resolves.toBeNull();
    });

    it("rejects a malformed token", async () => {
      await expect(verifyControlSecret("not-a-jwt", "legacy")).resolves.toBeNull();
    });

    it("fails closed when AUTH_SECRET is unset in multi-tenant mode", async () => {
      delete process.env.AUTH_SECRET;
      const jwt = await signControlJwt({ orgId: "org-1", role: "ADMIN" });
      await expect(verifyControlSecret(jwt, "legacy")).resolves.toBeNull();
    });
  });

  describe("verifyGraphicsSecret", () => {
    it("accepts a valid, unrevoked GRAPHICS ScopedToken", async () => {
      findUniqueMock.mockResolvedValue({ type: "GRAPHICS", orgId: "org-1", matchId: "m1", revokedAt: null });
      await expect(verifyGraphicsSecret("tok", "legacy")).resolves.toEqual({ orgId: "org-1", matchId: "m1" });
    });

    it("falls back to a graphics-role JWT when no GRAPHICS token matches", async () => {
      findUniqueMock.mockResolvedValue(null);
      const jwt = await signControlJwt({ orgId: "org-1", role: "graphics", matchId: "m1" });
      await expect(verifyGraphicsSecret(jwt, "legacy")).resolves.toEqual({ orgId: "org-1", matchId: "m1" });
    });

    it("rejects a JWT with a non-graphics role", async () => {
      findUniqueMock.mockResolvedValue(null);
      const jwt = await signControlJwt({ orgId: "org-1", role: "ADMIN" });
      await expect(verifyGraphicsSecret(jwt, "legacy")).resolves.toBeNull();
    });

    it("fails closed when AUTH_SECRET is unset in multi-tenant mode", async () => {
      findUniqueMock.mockResolvedValue(null);
      delete process.env.AUTH_SECRET;
      await expect(verifyGraphicsSecret("some-jwt", "legacy")).resolves.toBeNull();
    });

    it("returns null for a revoked GRAPHICS token that also fails JWT verification", async () => {
      findUniqueMock.mockResolvedValue({ type: "GRAPHICS", orgId: "org-1", revokedAt: new Date() });
      await expect(verifyGraphicsSecret("not-a-jwt", "legacy")).resolves.toBeNull();
    });
  });
});
