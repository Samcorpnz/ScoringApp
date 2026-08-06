import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CricketTab } from "../CricketTab";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

describe("CricketTab", () => {
  it("renders without a pre-existing cricket sportState, defaulting to innings 1", () => {
    render(
      <CricketTab
        state={{ ...DEFAULT_MATCH_STATE, sport: "cricket" } as MatchState}
        push={vi.fn()}
        sendReset={vi.fn()}
        sendUndo={vi.fn()}
        sendCricketBall={vi.fn()}
        sendCricketOverComplete={vi.fn()}
        sendCricketInningsChange={vi.fn()}
        sendCricketDeclare={vi.fn()}
        sendScoreAdjust={vi.fn()}
        sendIndoorCricketWicket={vi.fn()}
      />
    );
    expect(screen.getByTestId("score-reset-match")).toBeInTheDocument();
  });
});
