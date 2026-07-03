import { describe, it, expect } from "vitest";
import { getPeriodLabel } from "../sport-templates";
import { DEFAULT_MATCH_STATE, MatchState } from "../types";

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

describe("getPeriodLabel", () => {
  it("returns the static periodLabel for non-softball sports", () => {
    const state = makeState({ sport: "netball" });
    expect(getPeriodLabel(state)).toBe("QTR");
  });

  it("returns TOP for softball when sportState is not yet set", () => {
    const state = makeState({ sport: "softball" });
    expect(getPeriodLabel(state)).toBe("TOP");
  });

  it("returns TOP/BOT based on sportState.inningHalf for softball", () => {
    const top = makeState({
      sport: "softball",
      sportState: { sport: "softball", format: "fastpitch", inningHalf: "top", outs: 0, balls: 0, strikes: 0 },
    });
    const bottom = makeState({
      sport: "softball",
      sportState: { sport: "softball", format: "fastpitch", inningHalf: "bottom", outs: 0, balls: 0, strikes: 0 },
    });
    expect(getPeriodLabel(top)).toBe("TOP");
    expect(getPeriodLabel(bottom)).toBe("BOT");
  });

  it("returns '1ST INNINGS' for cricket when sportState is not yet set", () => {
    const state = makeState({ sport: "cricket" });
    expect(getPeriodLabel(state)).toBe("1ST INNINGS");
  });

  it("returns the ordinal innings label for cricket based on sportState.inningsNumber", () => {
    const state = makeState({
      sport: "cricket",
      sportState: { sport: "cricket", format: "test", inningsNumber: 3, innings: [], homeSquad: [], visitorSquad: [] },
    });
    expect(getPeriodLabel(state)).toBe("3RD INNINGS");
  });
});
