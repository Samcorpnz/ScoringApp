// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("verifyTurnstileToken", () => {
  const originalSecret = process.env.TURNSTILE_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env.TURNSTILE_SECRET = originalSecret;
  });

  it("passes through (returns true) when TURNSTILE_SECRET is not configured", async () => {
    delete process.env.TURNSTILE_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { verifyTurnstileToken } = await import("../turnstile");
    const result = await verifyTurnstileToken("", "127.0.0.1");
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when configured but no token is provided", async () => {
    process.env.TURNSTILE_SECRET = "secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { verifyTurnstileToken } = await import("../turnstile");
    const result = await verifyTurnstileToken("", "127.0.0.1");
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls siteverify and returns true on success", async () => {
    process.env.TURNSTILE_SECRET = "secret";
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const { verifyTurnstileToken } = await import("../turnstile");
    const result = await verifyTurnstileToken("tok", "1.2.3.4");
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
    const [, options] = fetchMock.mock.calls[0];
    const body = options.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("returns false when siteverify reports failure", async () => {
    process.env.TURNSTILE_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));

    const { verifyTurnstileToken } = await import("../turnstile");
    const result = await verifyTurnstileToken("tok", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("returns false when the siteverify response body isn't parseable", async () => {
    process.env.TURNSTILE_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => { throw new Error("bad json"); } }));

    const { verifyTurnstileToken } = await import("../turnstile");
    const result = await verifyTurnstileToken("tok", "1.2.3.4");
    expect(result).toBe(false);
  });
});
