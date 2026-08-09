import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ClockPanel } from "../ClockPanel";

afterEach(cleanup);

describe("ClockPanel", () => {
  it("renders the running indicator as LIVE when running, in green-ish accent", () => {
    render(
      <ClockPanel
        clockSeconds={125}
        countDown={false}
        period="1"
        isRunning={true}
        hornActive={false}
        matchName="Round 1"
      />
    );
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("02:05")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders PAUSED when not running", () => {
    render(
      <ClockPanel
        clockSeconds={30}
        countDown={false}
        period="1"
        isRunning={false}
        hornActive={false}
      />
    );
    expect(screen.getByText("PAUSED")).toBeInTheDocument();
  });

  it("shows period break headline for a regular break", () => {
    render(
      <ClockPanel
        clockSeconds={0}
        countDown={false}
        period="2"
        periodBreak={true}
        periodLabel="QTR"
        isRunning={false}
        hornActive={false}
      />
    );
    expect(screen.getByText("QTR BREAK")).toBeInTheDocument();
  });

  it("shows HALF TIME headline when periodLabel is HALF and on break", () => {
    render(
      <ClockPanel
        clockSeconds={0}
        countDown={false}
        period="2"
        periodBreak={true}
        periodLabel="HALF"
        isRunning={false}
        hornActive={false}
      />
    );
    expect(screen.getByText("HALF TIME")).toBeInTheDocument();
  });

  it("shows EXTRA TIME subtext when period is E and not on break", () => {
    render(
      <ClockPanel
        clockSeconds={0}
        countDown={false}
        period="E"
        periodBreak={false}
        periodLabel="QTR"
        isRunning={false}
        hornActive={false}
      />
    );
    expect(screen.getByText("EXTRA TIME")).toBeInTheDocument();
  });

  it("does not render the match name or running indicator in compact size", () => {
    render(
      <ClockPanel
        clockSeconds={60}
        countDown={false}
        period="1"
        isRunning={true}
        hornActive={false}
        matchName="Should not show"
        size="compact"
      />
    );
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("applies horn-active styling class when the horn is active", () => {
    const { container } = render(
      <ClockPanel
        clockSeconds={0}
        countDown={false}
        period="1"
        isRunning={false}
        hornActive={true}
      />
    );
    expect(container.querySelector(".horn-active")).toBeInTheDocument();
  });
});
