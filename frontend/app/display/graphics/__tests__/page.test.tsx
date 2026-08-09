import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import GraphicsDisplay from "../page";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

const { useMatchStateMock, useGraphicsSceneMock, useRosterMock } = vi.hoisted(() => ({
  useMatchStateMock: vi.fn(),
  useGraphicsSceneMock: vi.fn(),
  useRosterMock: vi.fn(),
}));

vi.mock("../../../hooks/useMatchState", () => ({
  useMatchState: useMatchStateMock,
}));
vi.mock("../../../hooks/useGraphicsScene", () => ({
  useGraphicsScene: useGraphicsSceneMock,
}));
vi.mock("../../../hooks/useRoster", () => ({
  useRoster: useRosterMock,
}));

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

beforeEach(() => {
  window.history.pushState({}, "", "/display/graphics");
  useMatchStateMock.mockReturnValue({ state: makeState() });
  useGraphicsSceneMock.mockReturnValue({ scene: null });
  useRosterMock.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("GraphicsDisplay", () => {
  it("renders nothing when there is no active scene and the org is entitled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entitled: true }) }));
    const { container } = render(<GraphicsDisplay />);
    await waitFor(() => expect(container.firstElementChild?.children.length).toBe(0));
  });

  it("renders the LowerThird scene when active and entitled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entitled: true }) }));
    useGraphicsSceneMock.mockReturnValue({ scene: { sceneType: "lowerThird", updatedAt: new Date().toISOString() } });
    useMatchStateMock.mockReturnValue({
      state: makeState({ home: { ...DEFAULT_MATCH_STATE.home, name: "Sharks" }, visitor: { ...DEFAULT_MATCH_STATE.visitor, name: "Eagles" } }),
    });
    render(<GraphicsDisplay />);
    await waitFor(() => expect(screen.getByText("Sharks")).toBeInTheDocument());
    expect(screen.getByText("Eagles")).toBeInTheDocument();
  });

  it("shows the upgrade prompt when the org is not entitled, even with an active scene", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entitled: false }) }));
    useGraphicsSceneMock.mockReturnValue({ scene: { sceneType: "lowerThird", updatedAt: new Date().toISOString() } });
    render(<GraphicsDisplay />);
    await waitFor(() => expect(screen.getByText(/Upgrade your plan/)).toBeInTheDocument());
    expect(screen.queryByText(DEFAULT_MATCH_STATE.home.name)).not.toBeInTheDocument();
  });

  it("renders nothing for an unregistered scene type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entitled: true }) }));
    useGraphicsSceneMock.mockReturnValue({ scene: { sceneType: "notARealScene", updatedAt: new Date().toISOString() } });
    const { container } = render(<GraphicsDisplay />);
    await waitFor(() => expect(container.firstElementChild?.children.length).toBe(0));
  });

  it("requests the entitlement endpoint scoped to the org query param", async () => {
    window.history.pushState({}, "", "/display/graphics?org=org-42");
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ entitled: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<GraphicsDisplay />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain("org=org-42");
  });

  it("treats a failed entitlement fetch as not-yet-resolved (renders nothing, no upgrade prompt)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { container } = render(<GraphicsDisplay />);
    await waitFor(() => expect(container.firstElementChild?.children.length).toBe(0));
    expect(screen.queryByText(/Upgrade your plan/)).not.toBeInTheDocument();
  });
});
