import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CricketDisplayStats } from "../CricketDisplayStats";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { CricketState, MatchState } from "@scorehub/types";

function makeCricketState(): CricketState {
  return {
    sport: "cricket",
    format: "t20",
    inningsNumber: 1,
    innings: [{
      battingTeam: "home", runs: 42, wickets: 1, oversComplete: 5, ballsThisOver: 2,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
      batters: [], bowlers: [], currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0,
      thisOverBalls: [],
    }],
    homeSquad: [],
    visitorSquad: [],
  };
}

describe("CricketDisplayStats", () => {
  it("renders the last innings' run rate for the full variant", () => {
    const state = { ...DEFAULT_MATCH_STATE, sportState: makeCricketState() } as unknown as MatchState;
    const { container } = render(<CricketDisplayStats state={state} />);
    expect(container.textContent).toContain("CRR");
  });

  it("renders nothing when the match has no cricket sportState", () => {
    const { container } = render(<CricketDisplayStats state={DEFAULT_MATCH_STATE as MatchState} />);
    expect(container).toBeEmptyDOMElement();
  });
});
