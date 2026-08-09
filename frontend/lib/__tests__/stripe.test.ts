// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const StripeCtorMock = vi.fn();
class FakeStripe {
  __stripeKey: string;
  constructor(key: string) {
    StripeCtorMock(key);
    this.__stripeKey = key;
  }
}
vi.mock("stripe", () => ({
  default: FakeStripe,
}));

describe("getStripe", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    StripeCtorMock.mockClear();
    delete (globalThis as unknown as { stripe?: unknown }).stripe;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    delete (globalThis as unknown as { stripe?: unknown }).stripe;
  });

  it("throws when STRIPE_SECRET_KEY is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("../stripe");
    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
  });

  it("constructs a Stripe client using the configured secret key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubEnv("NODE_ENV", "development");
    const { getStripe } = await import("../stripe");
    const client = getStripe();
    expect(StripeCtorMock).toHaveBeenCalledWith("sk_test_123");
    expect(client).toMatchObject({ __stripeKey: "sk_test_123" });
  });

  it("caches (memoizes) the client across calls outside production", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubEnv("NODE_ENV", "development");
    const { getStripe } = await import("../stripe");
    const first = getStripe();
    const second = getStripe();
    expect(first).toBe(second);
    expect(StripeCtorMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache the client in production (constructs fresh each time)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubEnv("NODE_ENV", "production");
    const { getStripe } = await import("../stripe");
    getStripe();
    getStripe();
    expect(StripeCtorMock).toHaveBeenCalledTimes(2);
  });
});
