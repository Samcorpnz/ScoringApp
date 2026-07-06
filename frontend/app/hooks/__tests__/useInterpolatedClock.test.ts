import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInterpolatedClock } from "../useInterpolatedClock";

describe("useInterpolatedClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the server clock value as-is when not running", () => {
    const { result } = renderHook(() =>
      useInterpolatedClock({ clockSeconds: 90, isRunning: false, countDown: true })
    );
    expect(result.current).toBe(90);
  });

  it("counts down while running, interpolating between relay ticks", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useInterpolatedClock({ clockSeconds: 100, isRunning: true, countDown: true })
    );
    expect(result.current).toBe(100);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeLessThan(100);
    expect(result.current).toBeGreaterThan(98);
  });

  it("counts up while running when countDown is false", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useInterpolatedClock({ clockSeconds: 0, isRunning: true, countDown: false })
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeGreaterThan(0);
  });

  it("never goes below zero", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useInterpolatedClock({ clockSeconds: 0.05, isRunning: true, countDown: true })
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(0);
  });

  it("re-syncs to the new server value when clockSeconds changes", () => {
    const { result, rerender } = renderHook(
      ({ clockSeconds }) => useInterpolatedClock({ clockSeconds, isRunning: false, countDown: true }),
      { initialProps: { clockSeconds: 50 } }
    );
    expect(result.current).toBe(50);
    rerender({ clockSeconds: 42 });
    expect(result.current).toBe(42);
  });

  it("returns the precise carry-adjusted value when the relay supplies an anchor/carry", () => {
    const { result } = renderHook(() =>
      useInterpolatedClock({
        clockSeconds: 90, isRunning: false, countDown: true,
        clockAnchorMs: Date.now(), clockCarryMs: 700,
      })
    );
    // Countdown: 90s baseline minus 0.7s of already-elapsed carry = 89.3
    expect(result.current).toBeCloseTo(89.3, 5);
  });

  it("does not snap backward to the bare integer when stopping with a non-zero carry", () => {
    const { result, rerender } = renderHook(
      ({ isRunning }) => useInterpolatedClock({
        clockSeconds: 90, isRunning, countDown: true,
        clockAnchorMs: Date.now(), clockCarryMs: 400,
      }),
      { initialProps: { isRunning: true } }
    );
    rerender({ isRunning: false });
    // Precise value (90 - 0.4 = 89.6), not the bare integer (90) — no
    // backward-then-forward jump at the instant of stop.
    expect(result.current).toBeCloseTo(89.6, 5);
    expect(result.current).not.toBe(90);
  });
});
