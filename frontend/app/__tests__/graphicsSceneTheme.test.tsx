import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LowerThird } from "../display/graphics/scenes/LowerThird";
import { PlayerStatCard } from "../display/graphics/scenes/PlayerStatCard";
import { PlayerHeadshotBio } from "../display/graphics/scenes/PlayerHeadshotBio";
import { DEFAULT_MATCH_STATE } from "../types";
import type { MatchState } from "@scorehub/types";

// Phase C0: graphics scenes should read state.home.color/state.visitor.color
// (as the rest of the app's control panel already does, e.g. ScoreTab.tsx)
// instead of hardcoding var(--home-color)/var(--visitor-color), and should
// use the themed --graphics-card-bg tint (wired in display/graphics/page.tsx)
// with a fallback for contexts that render a scene without that wrapper.

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

describe("graphics scenes — theme wiring", () => {
  it("LowerThird uses custom team colors when set on state", () => {
    const state = makeState({
      home: { ...DEFAULT_MATCH_STATE.home, color: "#123456" },
      visitor: { ...DEFAULT_MATCH_STATE.visitor, color: "#abcdef" },
    });
    const { container } = render(<LowerThird state={state} />);
    const scoreSpans = container.querySelectorAll(".score-digit");
    expect(scoreSpans[0]).toHaveStyle({ color: "rgb(18, 52, 86)" });
    expect(scoreSpans[1]).toHaveStyle({ color: "rgb(171, 205, 239)" });
  });

  it("LowerThird card falls back to the default tint when no theme wrapper is present", () => {
    const { container } = render(<LowerThird state={makeState()} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.background).toContain("var(--graphics-card-bg");
  });

  it("PlayerStatCard uses the matched player's team color", () => {
    const state = makeState({
      home: { ...DEFAULT_MATCH_STATE.home, color: "#123456" },
      graphicsFeed: {
        provider: "championdata",
        sport: "netball",
        version: 1,
        capturedAt: new Date().toISOString(),
        stats: {
          team: { home: {}, visitor: {} },
          players: [{ id: "1", name: "Test Player", team: "home", stats: {} }],
        },
      },
    });
    const { container } = render(<PlayerStatCard payload={{ playerId: "1" }} state={state} />);
    const swatch = container.querySelector("span[style*='background']") as HTMLElement;
    expect(swatch).toHaveStyle({ backgroundColor: "rgb(18, 52, 86)" });
  });

  it("PlayerHeadshotBio uses the matched player's team color for the avatar border", () => {
    const state = makeState({
      visitor: { ...DEFAULT_MATCH_STATE.visitor, color: "#abcdef" },
      graphicsFeed: {
        provider: "championdata",
        sport: "netball",
        version: 1,
        capturedAt: new Date().toISOString(),
        stats: {
          team: { home: {}, visitor: {} },
          players: [{ id: "2", name: "Another Player", team: "visitor", stats: {} }],
        },
      },
    });
    const { getByText } = render(<PlayerHeadshotBio payload={{ playerId: "2" }} state={state} />);
    const avatar = getByText("AP");
    expect(avatar.style.borderColor).toBe("rgb(171, 205, 239)");
  });
});
