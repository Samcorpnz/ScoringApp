import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScorePanel } from "../ScorePanel";
import { DEFAULT_MATCH_STATE } from "../../types";
import type { TeamState } from "@scorehub/types";

afterEach(cleanup);

function makeTeam(overrides: Partial<TeamState> = {}): TeamState {
  return { ...DEFAULT_MATCH_STATE.home, ...overrides } as TeamState;
}

describe("ScorePanel", () => {
  it("renders the team name and score in full size", () => {
    render(<ScorePanel team={makeTeam({ name: "Sharks", score: 12 })} side="home" possession="none" />);
    expect(screen.getByText("Sharks")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("falls back to HOME/VISITOR labels when the team has no name", () => {
    render(<ScorePanel team={makeTeam({ name: "" })} side="visitor" possession="none" />);
    expect(screen.getByText("VISITOR")).toBeInTheDocument();
  });

  it("uses scoreText override instead of the numeric score when provided", () => {
    render(<ScorePanel team={makeTeam({ score: 3 })} side="home" possession="none" scoreText="3/1" />);
    expect(screen.getByText("3/1")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows faults and timeouts when present", () => {
    render(<ScorePanel team={makeTeam({ faults: 2, timeouts: 1 })} side="home" possession="none" />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("FLS")).toBeInTheDocument();
    expect(screen.getByText("TOs")).toBeInTheDocument();
  });

  it("does not render faults/timeouts/possession/logo in compact size", () => {
    render(
      <ScorePanel
        team={makeTeam({ faults: 2, timeouts: 1, logoUrl: "https://example.com/logo.png" })}
        side="home"
        possession="home"
        size="compact"
      />
    );
    expect(screen.queryByText("FLS")).not.toBeInTheDocument();
    expect(screen.queryByText("TOs")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("resolves a relay-relative logo URL and renders an image", () => {
    render(
      <ScorePanel
        team={makeTeam({ logoUrl: "/logos/home.png" })}
        side="home"
        possession="none"
        relayUrl="http://localhost:4000"
      />
    );
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("logos%2Fhome.png");
  });

  it("renders in scorebug layout with score before the crest for the visitor side", () => {
    render(
      <ScorePanel team={makeTeam({ name: "Sharks", score: 5 })} side="visitor" possession="none" size="scorebug" />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Sharks")).toBeInTheDocument();
  });

  it("renders in scorebug layout with the initials fallback when no logo", () => {
    render(
      <ScorePanel team={makeTeam({ name: "Sharks", logoUrl: "" })} side="home" possession="both" size="scorebug" />
    );
    expect(screen.getByText("SHA")).toBeInTheDocument();
  });
});
