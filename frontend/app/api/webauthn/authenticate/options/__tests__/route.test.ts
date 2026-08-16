// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const isRateLimitedMock = vi.fn((..._a: unknown[]) => false);
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimitedMock(...a),
  clientIp: () => "127.0.0.1",
}));

const generateAuthenticationOptionsMock = vi.fn();
vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: (...a: unknown[]) => generateAuthenticationOptionsMock(...a),
}));

const createChallengeMock = vi.fn();
vi.mock("@/lib/webauthn", () => ({
  createChallenge: (...a: unknown[]) => createChallengeMock(...a),
  rpID: () => "localhost",
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/webauthn/authenticate/options", { method: "POST" });
}

describe("POST /api/webauthn/authenticate/options", () => {
  beforeEach(() => {
    vi.resetModules();
    isRateLimitedMock.mockReset().mockReturnValue(false);
    generateAuthenticationOptionsMock.mockReset();
    createChallengeMock.mockReset();
  });

  it("429s when rate-limited", async () => {
    isRateLimitedMock.mockReturnValue(true);
    const { POST } = await import("../route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(generateAuthenticationOptionsMock).not.toHaveBeenCalled();
  });

  it("generates usernameless options (empty allowCredentials), stores a challenge with no userId, and returns options", async () => {
    generateAuthenticationOptionsMock.mockResolvedValue({ challenge: "chal-1", rpId: "localhost" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest());

    expect(generateAuthenticationOptionsMock).toHaveBeenCalledWith({
      rpID: "localhost",
      userVerification: "preferred",
      allowCredentials: [],
    });
    expect(createChallengeMock).toHaveBeenCalledWith("chal-1", "authentication", null);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: "chal-1", rpId: "localhost" });
  });
});
