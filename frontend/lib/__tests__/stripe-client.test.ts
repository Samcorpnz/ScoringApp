// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const loadStripeMock = vi.fn();
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: (...args: unknown[]) => loadStripeMock(...args),
}));

describe("getStripeClient", () => {
  const originalKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    loadStripeMock.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey;
  });

  it("throws when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured", async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const { getStripeClient } = await import("../stripe-client");
    expect(() => getStripeClient()).toThrow(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured",
    );
  });

  it("calls loadStripe with the configured publishable key", async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
    const fakePromise = Promise.resolve(null);
    loadStripeMock.mockReturnValue(fakePromise);
    const { getStripeClient } = await import("../stripe-client");
    const result = getStripeClient();
    expect(loadStripeMock).toHaveBeenCalledWith("pk_test_123");
    expect(result).toBe(fakePromise);
  });

  it("memoizes the promise across calls (loadStripe called only once)", async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
    loadStripeMock.mockReturnValue(Promise.resolve(null));
    const { getStripeClient } = await import("../stripe-client");
    const first = getStripeClient();
    const second = getStripeClient();
    expect(first).toBe(second);
    expect(loadStripeMock).toHaveBeenCalledTimes(1);
  });
});
