// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the config object passed to NextAuth() and the credentials
// provider config, so we can exercise the authorize/jwt/session callbacks
// directly without going through NextAuth's own request/response machinery.
let capturedConfig: any;
let capturedCredentialsConfig: any;

vi.mock("next-auth", () => ({
  default: (config: unknown) => {
    capturedConfig = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (config: unknown) => {
    capturedCredentialsConfig = config;
    return { id: "credentials", type: "credentials", ...(config as object) };
  },
}));

const bcryptCompareMock = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { compare: (...a: unknown[]) => bcryptCompareMock(...a) },
}));

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
vi.mock("@scorehub/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => findUniqueMock(...a) },
    membership: { findMany: (...a: unknown[]) => findManyMock(...a) },
  },
  Role: {},
}));

const isRateLimitedMock = vi.fn();
const clientIpMock = vi.fn();
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: (...a: unknown[]) => clientIpMock(...a),
}));

describe("auth.ts", () => {
  beforeEach(async () => {
    vi.resetModules();
    findUniqueMock.mockReset();
    findManyMock.mockReset();
    bcryptCompareMock.mockReset();
    isRateLimitedMock.mockReset().mockReturnValue(false);
    clientIpMock.mockReset().mockReturnValue("127.0.0.1");
    await import("../auth");
  });

  describe("authorize", () => {
    function authorize(credentials: unknown) {
      return capturedCredentialsConfig.authorize(credentials, new Request("http://localhost"));
    }

    it("returns null when email is missing", async () => {
      await expect(authorize({ password: "secret" })).resolves.toBeNull();
    });

    it("returns null when password is missing", async () => {
      await expect(authorize({ email: "a@b.com" })).resolves.toBeNull();
    });

    it("returns null when credentials fields aren't strings", async () => {
      await expect(authorize({ email: 123, password: {} })).resolves.toBeNull();
    });

    it("rate-limits repeated attempts by IP+email", async () => {
      isRateLimitedMock.mockReturnValue(true);
      const result = await authorize({ email: "a@b.com", password: "secret" });
      expect(result).toBeNull();
      expect(isRateLimitedMock).toHaveBeenCalledWith("login:127.0.0.1:a@b.com", 10, 60_000);
      expect(findUniqueMock).not.toHaveBeenCalled();
    });

    it("returns null when no user exists for the email", async () => {
      findUniqueMock.mockResolvedValue(null);
      const result = await authorize({ email: "nobody@b.com", password: "secret" });
      expect(result).toBeNull();
    });

    it("returns null when the password doesn't match", async () => {
      findUniqueMock.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        name: "A",
        passwordHash: "hash",
        memberships: [],
      });
      bcryptCompareMock.mockResolvedValue(false);
      const result = await authorize({ email: "a@b.com", password: "wrong" });
      expect(result).toBeNull();
    });

    it("returns the user with mapped memberships and first org as active on success", async () => {
      findUniqueMock.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        name: "A",
        passwordHash: "hash",
        memberships: [
          { orgId: "org-1", role: "ADMIN", org: { name: "Org One" } },
          { orgId: "org-2", role: "OPERATOR", org: { name: "Org Two" } },
        ],
      });
      bcryptCompareMock.mockResolvedValue(true);
      const result = await authorize({ email: "a@b.com", password: "correct" });
      expect(result).toEqual({
        id: "u1",
        name: "A",
        email: "a@b.com",
        memberships: [
          { orgId: "org-1", orgName: "Org One", role: "ADMIN" },
          { orgId: "org-2", orgName: "Org Two", role: "OPERATOR" },
        ],
        activeOrgId: "org-1",
      });
    });

    it("sets activeOrgId to null when the user has no memberships", async () => {
      findUniqueMock.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        name: "A",
        passwordHash: "hash",
        memberships: [],
      });
      bcryptCompareMock.mockResolvedValue(true);
      const result = await authorize({ email: "a@b.com", password: "correct" });
      expect(result).toMatchObject({ activeOrgId: null, memberships: [] });
    });
  });

  describe("jwt callback", () => {
    function jwt(args: any) {
      return capturedConfig.callbacks.jwt(args);
    }

    it("seeds the token from the user object on initial sign-in", async () => {
      const token: any = {};
      const user = {
        memberships: [{ orgId: "org-1", orgName: "Org One", role: "ADMIN" }],
        activeOrgId: "org-1",
      };
      const result = await jwt({ token, user, trigger: "signIn" });
      expect(result.memberships).toEqual(user.memberships);
      expect(result.activeOrgId).toBe("org-1");
    });

    it("leaves the token unchanged when there's no user and no update trigger", async () => {
      const token = { memberships: [{ orgId: "org-1", orgName: "Org One", role: "ADMIN" }], activeOrgId: "org-1" };
      const result = await jwt({ token, user: undefined, trigger: "update" as const, session: undefined });
      expect(result).toBe(token);
    });

    it("re-fetches memberships and switches activeOrgId on a valid org-switch update", async () => {
      const token: any = { sub: "u1", memberships: [], activeOrgId: "org-1" };
      findManyMock.mockResolvedValue([
        { orgId: "org-1", role: "ADMIN", org: { name: "Org One" } },
        { orgId: "org-2", role: "OPERATOR", org: { name: "Org Two" } },
      ]);
      const result = await jwt({
        token,
        user: undefined,
        trigger: "update",
        session: { activeOrgId: "org-2" },
      });
      expect(result.activeOrgId).toBe("org-2");
      expect(result.memberships).toEqual([
        { orgId: "org-1", orgName: "Org One", role: "ADMIN" },
        { orgId: "org-2", orgName: "Org Two", role: "OPERATOR" },
      ]);
    });

    it("ignores an org-switch update to an org the user isn't a member of", async () => {
      const token: any = { sub: "u1", memberships: [{ orgId: "org-1", orgName: "Org One", role: "ADMIN" }], activeOrgId: "org-1" };
      findManyMock.mockResolvedValue([
        { orgId: "org-1", role: "ADMIN", org: { name: "Org One" } },
      ]);
      const result = await jwt({
        token,
        user: undefined,
        trigger: "update",
        session: { activeOrgId: "org-not-a-member" },
      });
      // token.activeOrgId stays as it was — the fresh list didn't contain the target org
      expect(result.activeOrgId).toBe("org-1");
    });

    it("does not query the DB when trigger is 'update' but session has no activeOrgId", async () => {
      const token: any = { sub: "u1", activeOrgId: "org-1" };
      const result = await jwt({ token, user: undefined, trigger: "update", session: {} });
      expect(findManyMock).not.toHaveBeenCalled();
      expect(result.activeOrgId).toBe("org-1");
    });
  });

  describe("session callback", () => {
    function session(args: any) {
      return capturedConfig.callbacks.session(args);
    }

    it("populates session.user from the token, deriving activeRole from the matching membership", async () => {
      const token = {
        sub: "u1",
        memberships: [
          { orgId: "org-1", orgName: "Org One", role: "ADMIN" },
          { orgId: "org-2", orgName: "Org Two", role: "OPERATOR" },
        ],
        activeOrgId: "org-2",
      };
      const result = await session({ session: { user: {} }, token });
      expect(result.user.id).toBe("u1");
      expect(result.user.memberships).toEqual(token.memberships);
      expect(result.user.activeOrgId).toBe("org-2");
      expect(result.user.activeRole).toBe("OPERATOR");
    });

    it("defaults memberships to [] and activeOrgId/activeRole to null when the token has none", async () => {
      const token = { sub: "u1" };
      const result = await session({ session: { user: {} }, token });
      expect(result.user.memberships).toEqual([]);
      expect(result.user.activeOrgId).toBeNull();
      expect(result.user.activeRole).toBeNull();
    });

    it("does not set user.id when the token has no sub", async () => {
      const token = { memberships: [], activeOrgId: null };
      const result = await session({ session: { user: { id: "preexisting" } }, token });
      expect(result.user.id).toBe("preexisting");
    });
  });
});
