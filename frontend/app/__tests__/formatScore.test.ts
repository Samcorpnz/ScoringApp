import { describe, it, expect } from "vitest";
import { formatScore, DEFAULT_MATCH_STATE, MatchState } from "../types";

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

describe("formatScore", () => {
  it("returns the plain score for non-cricket sports", () => {
    const state = makeState({ sport: "netball", home: { ...DEFAULT_MATCH_STATE.home, score: 12 } });
    expect(formatScore(state, "home")).toBe("12");
  });

  it("returns runs/wickets for indoor_cricket", () => {
    const state = makeState({
      sport: "indoor_cricket",
      home: { ...DEFAULT_MATCH_STATE.home, score: 87 },
      sportState: { sport: "indoor_cricket", wicketPenalty: 5, homeWickets: 6, visitorWickets: 2, oversPerInnings: 8 },
    });
    expect(formatScore(state, "home")).toBe("87/6");
    expect(formatScore(state, "visitor")).toBe("0/2");
  });

  it("defaults wickets to 0 when sportState is not yet set", () => {
    const state = makeState({ sport: "indoor_cricket", home: { ...DEFAULT_MATCH_STATE.home, score: 4 } });
    expect(formatScore(state, "home")).toBe("4/0");
  });
});
