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

  it("returns runs/wickets for the batting team's current innings in cricket", () => {
    const state = makeState({
      sport: "cricket",
      sportState: {
        sport: "cricket", format: "t20", inningsNumber: 1,
        innings: [{
          battingTeam: "home", runs: 123, wickets: 4, oversComplete: 15, ballsThisOver: 2,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
          batters: [], bowlers: [], currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0,
          thisOverBalls: [],
        }],
        homeSquad: [], visitorSquad: [],
      },
    });
    expect(formatScore(state, "home")).toBe("123/4");
    expect(formatScore(state, "visitor")).toBe("0/0");
  });

  it("returns 0/0 for cricket when sportState is not yet set", () => {
    const state = makeState({ sport: "cricket" });
    expect(formatScore(state, "home")).toBe("0/0");
  });
});
