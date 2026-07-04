import { resyncClock, ClockAnchorState } from "../clock";

function makeState(overrides: Partial<ClockAnchorState> = {}): ClockAnchorState {
  return {
    clockSeconds: 100,
    countDown: true,
    ...overrides,
  };
}

describe("resyncClock", () => {
  it("is a no-op when no time has elapsed since the anchor", () => {
    const t0 = 1_000_000;
    const state = makeState({ clockAnchorMs: t0, clockCarryMs: 0 });
    const result = resyncClock(state, t0);
    expect(result.clockSeconds).toBe(100);
    expect(result.clockCarryMs).toBe(0);
    expect(result.clockAnchorMs).toBe(t0);
  });

  it("folds elapsed ms into whole seconds + carry for a countdown clock", () => {
    const t0 = 1_000_000;
    const state = makeState({ clockSeconds: 100, clockAnchorMs: t0, clockCarryMs: 0, countDown: true });
    const result = resyncClock(state, t0 + 30_700);
    expect(result.clockSeconds).toBe(70); // 100 - 30
    expect(result.clockCarryMs).toBe(700);
  });

  it("folds elapsed ms into whole seconds + carry for a count-up clock", () => {
    const t0 = 1_000_000;
    const state = makeState({ clockSeconds: 0, clockAnchorMs: t0, clockCarryMs: 0, countDown: false });
    const result = resyncClock(state, t0 + 30_700);
    expect(result.clockSeconds).toBe(30);
    expect(result.clockCarryMs).toBe(700);
  });

  it("treats a missing anchor as 'anchor starts now' — no elapsed time assumed", () => {
    const now = 1_000_000;
    const state = makeState({ clockAnchorMs: undefined, clockCarryMs: 0 });
    const result = resyncClock(state, now);
    expect(result.clockSeconds).toBe(100);
    expect(result.clockCarryMs).toBe(0);
    expect(result.clockAnchorMs).toBe(now);
  });

  it("includes a non-zero starting carry banked from a previous cycle", () => {
    const t0 = 1_000_000;
    // Already had 800ms banked; running for another 900ms should fold to
    // 1700ms total -> 1 whole second + 700ms carry.
    const state = makeState({ clockSeconds: 100, clockAnchorMs: t0, clockCarryMs: 800, countDown: true });
    const result = resyncClock(state, t0 + 900);
    expect(result.clockSeconds).toBe(99);
    expect(result.clockCarryMs).toBe(700);
  });

  it("never discards elapsed time across a chain of stop/start cycles with odd fractional gaps", () => {
    // Simulate: run 700ms, stop, run 450ms, stop, run 900ms, stop.
    // Total real elapsed running time: 700 + 450 + 900 = 2050ms.
    let t = 1_000_000;
    let state = makeState({ clockSeconds: 1000, clockAnchorMs: t, clockCarryMs: 0, countDown: true });

    t += 700;
    state = { ...state, ...resyncClock(state, t) }; // "stop" checkpoint 1

    t += 1_000; // stopped gap, irrelevant — clock isn't ticking, so re-anchor to now on "start"
    state = { ...state, clockAnchorMs: t };

    t += 450;
    state = { ...state, ...resyncClock(state, t) }; // "stop" checkpoint 2

    t += 1_000;
    state = { ...state, clockAnchorMs: t };

    t += 900;
    const final = resyncClock(state, t); // "stop" checkpoint 3

    const totalElapsedMs = 700 + 450 + 900;
    const totalCountedMs = (1000 - final.clockSeconds) * 1000 + final.clockCarryMs;
    expect(totalCountedMs).toBe(totalElapsedMs);
  });

  it("re-anchors to nowMs after resyncing, so repeated calls at the same instant are idempotent", () => {
    const t0 = 1_000_000;
    const state = makeState({ clockAnchorMs: t0, clockCarryMs: 0 });
    const once = resyncClock(state, t0 + 1_500);
    const twice = resyncClock({ ...state, ...once }, t0 + 1_500);
    expect(twice).toEqual({ ...once, clockAnchorMs: t0 + 1_500 });
  });
});
