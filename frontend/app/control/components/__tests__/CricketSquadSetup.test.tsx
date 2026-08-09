import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CricketSquadSetup, emptySquad } from "../CricketSquadSetup";

afterEach(cleanup);

describe("emptySquad", () => {
  it("returns 11 empty strings", () => {
    const squad = emptySquad();
    expect(squad).toHaveLength(11);
    expect(squad.every(s => s === "")).toBe(true);
  });
});

describe("CricketSquadSetup", () => {
  it("shows missing-player messages and disables submit when squads are under-filled", () => {
    render(
      <CricketSquadSetup
        homeTeamName="Sharks"
        visitorTeamName="Eagles"
        homeSquad={emptySquad()}
        visitorSquad={emptySquad()}
        onChangeHome={vi.fn()}
        onChangeVisitor={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getAllByText("Add 2 more players")).toHaveLength(2);
    expect(screen.getByTestId("squad-submit")).toBeDisabled();
  });

  it("singularizes the missing-player message when only 1 is missing", () => {
    const homeSquad = emptySquad();
    homeSquad[0] = "Player A";
    render(
      <CricketSquadSetup
        homeTeamName="Sharks"
        visitorTeamName="Eagles"
        homeSquad={homeSquad}
        visitorSquad={emptySquad()}
        onChangeHome={vi.fn()}
        onChangeVisitor={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText("Add 1 more player")).toBeInTheDocument();
  });

  it("enables submit once both squads have at least the minimum players and calls onSubmit", () => {
    const homeSquad = emptySquad();
    homeSquad[0] = "A"; homeSquad[1] = "B";
    const visitorSquad = emptySquad();
    visitorSquad[0] = "C"; visitorSquad[1] = "D";
    const onSubmit = vi.fn();
    render(
      <CricketSquadSetup
        homeTeamName="Sharks"
        visitorTeamName="Eagles"
        homeSquad={homeSquad}
        visitorSquad={visitorSquad}
        onChangeHome={vi.fn()}
        onChangeVisitor={vi.fn()}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const submit = screen.getByTestId("squad-submit");
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("calls onChangeHome/onChangeVisitor with the index when a player name is edited", () => {
    const onChangeHome = vi.fn();
    const onChangeVisitor = vi.fn();
    render(
      <CricketSquadSetup
        homeTeamName="Sharks"
        visitorTeamName="Eagles"
        homeSquad={emptySquad()}
        visitorSquad={emptySquad()}
        onChangeHome={onChangeHome}
        onChangeVisitor={onChangeVisitor}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("squad-home-player-0"), { target: { value: "New Player" } });
    expect(onChangeHome).toHaveBeenCalledWith(0, "New Player");

    fireEvent.change(screen.getByTestId("squad-visitor-player-3"), { target: { value: "Other Player" } });
    expect(onChangeVisitor).toHaveBeenCalledWith(3, "Other Player");
  });

  it("calls onBack when the back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <CricketSquadSetup
        homeTeamName=""
        visitorTeamName=""
        homeSquad={emptySquad()}
        visitorSquad={emptySquad()}
        onChangeHome={vi.fn()}
        onChangeVisitor={vi.fn()}
        onBack={onBack}
        onSubmit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("squad-back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("falls back to Home/Visitor labels when team names are empty", () => {
    render(
      <CricketSquadSetup
        homeTeamName=""
        visitorTeamName=""
        homeSquad={emptySquad()}
        visitorSquad={emptySquad()}
        onChangeHome={vi.fn()}
        onChangeVisitor={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Visitor")).toBeInTheDocument();
  });
});
