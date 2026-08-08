import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useControlToken } from "../useControlToken";

// Regression coverage for SA-102's follow-up: a failed fetch (e.g. a 429
// from this route's own rate limit) used to be silently swallowed with no
// retry until the next 50-minute refresh, leaving the control panel stuck
// offline. It should now retry with backoff instead.
//
// Uses real timers (not vi.useFakeTimers()) — testing-library's waitFor
// polls with its own timer, which stalls indefinitely if fake timers are
// active without also manually driving them. The retry delay under test
// (1s) is short enough to just wait for in real time.

describe("useControlToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the token on a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "tok-1" }) }));
    const { result } = renderHook(() => useControlToken());
    await waitFor(() => expect(result.current).toBe("tok-1"));
  });

  it("retries after a failed (e.g. 429) response instead of waiting for the 50-minute refresh", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "tok-after-retry" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useControlToken());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe("");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
    await waitFor(() => expect(result.current).toBe("tok-after-retry"));
  }, 10_000);
});
