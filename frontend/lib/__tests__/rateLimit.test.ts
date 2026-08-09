import { describe, it, expect, beforeEach, vi } from "vitest";
import { isRateLimited, clientIp } from "../rateLimit";

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const key = `test-key-${Math.random()}`;
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
    expect(isRateLimited(key, 3, 60_000)).toBe(false);
  });

  it("blocks once the count exceeds the limit", () => {
    const key = `test-key-${Math.random()}`;
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    // third hit within the window pushes count to 3, which is > limit(2)
    expect(isRateLimited(key, 2, 60_000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    expect(isRateLimited(keyA, 1, 60_000)).toBe(false);
    expect(isRateLimited(keyA, 1, 60_000)).toBe(true);
    // keyB has its own independent window
    expect(isRateLimited(keyB, 1, 60_000)).toBe(false);
  });

  it("expires old hits outside the sliding window, allowing requests again", () => {
    vi.useFakeTimers();
    try {
      const key = `test-window-${Math.random()}`;
      vi.setSystemTime(0);
      expect(isRateLimited(key, 1, 1_000)).toBe(false);
      expect(isRateLimited(key, 1, 1_000)).toBe(true);

      // advance past the window so old hits are filtered out
      vi.setSystemTime(2_000);
      expect(isRateLimited(key, 1, 1_000)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip when present", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace on x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "  1.2.3.4  " },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to the last hop of x-forwarded-for when x-real-ip is absent", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8, 7.7.7.7" },
    });
    expect(clientIp(req)).toBe("7.7.7.7");
  });

  it("ignores a blank x-real-ip header and falls back to x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "   ", "x-forwarded-for": "5.5.5.5" },
    });
    expect(clientIp(req)).toBe("5.5.5.5");
  });

  it("returns 'unknown' when neither header is present", () => {
    const req = new Request("http://localhost");
    expect(clientIp(req)).toBe("unknown");
  });

  it("returns 'unknown' when x-forwarded-for is present but empty after filtering", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  ,  ," },
    });
    expect(clientIp(req)).toBe("unknown");
  });
});
