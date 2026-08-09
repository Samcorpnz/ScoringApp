import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GraphicsControlPage from "../page";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

const {
  pushMock,
  searchParamsMock,
  useSessionMock,
  useMatchStateMock,
  useGraphicsTokenMock,
  useGraphicsSceneMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: vi.fn(),
  useSessionMock: vi.fn(),
  useMatchStateMock: vi.fn(),
  useGraphicsTokenMock: vi.fn(),
  useGraphicsSceneMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

vi.mock("../../../hooks/useMatchState", () => ({
  useMatchState: useMatchStateMock,
}));

vi.mock("../../../hooks/useGraphicsToken", () => ({
  useGraphicsToken: useGraphicsTokenMock,
}));

vi.mock("../../../hooks/useGraphicsScene", () => ({
  useGraphicsScene: useGraphicsSceneMock,
}));

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

beforeEach(() => {
  searchParamsMock.mockReturnValue({ get: () => null });
  useSessionMock.mockReturnValue({ data: { user: { activeRole: "OPERATOR" } }, status: "authenticated" });
  useGraphicsTokenMock.mockReturnValue({ token: "graphics-token", status: "ok" });
  useMatchStateMock.mockReturnValue({ state: makeState() });
  useGraphicsSceneMock.mockReturnValue({ scene: null, status: "connected", setScene: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GraphicsControlPage", () => {
  it("redirects unauthenticated users to login", () => {
    useSessionMock.mockImplementation((opts?: { onUnauthenticated?: () => void }) => {
      opts?.onUnauthenticated?.();
      return { data: null, status: "unauthenticated" };
    });
    render(<GraphicsControlPage />);
    expect(pushMock).toHaveBeenCalledWith("/login?callbackUrl=/control/graphics");
  });

  it("shows the upsell (with an admin CTA) when the org lacks the graphics entitlement", () => {
    useGraphicsTokenMock.mockReturnValue({ token: "", status: "forbidden" });
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "ADMIN" } }, status: "authenticated" });
    render(<GraphicsControlPage />);
    expect(screen.getByText("Unlock Graphics Control")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add Graphics/ })).toBeInTheDocument();
  });

  it("shows a non-admin upsell message (no CTA link) for non-admin users when forbidden", () => {
    useGraphicsTokenMock.mockReturnValue({ token: "", status: "forbidden" });
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "OPERATOR" } }, status: "authenticated" });
    render(<GraphicsControlPage />);
    expect(screen.getByText(/Ask your account admin/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Add Graphics/ })).not.toBeInTheDocument();
  });

  it("renders the scene control UI with the match name once entitled", () => {
    useMatchStateMock.mockReturnValue({ state: makeState({ matchName: "Grand Final" }) });
    render(<GraphicsControlPage />);
    expect(screen.getByText("Graphics Control")).toBeInTheDocument();
    expect(screen.getByText("Grand Final")).toBeInTheDocument();
    expect(screen.getByTestId("scene-btn-lowerThird")).toBeInTheDocument();
  });

  it("shows a no-live-feed message when there is no graphicsFeed", () => {
    render(<GraphicsControlPage />);
    expect(screen.getAllByText(/No live player feed yet/)).toHaveLength(2);
  });

  it("calls setScene with the lowerThird scene when its button is clicked", () => {
    const setScene = vi.fn();
    useGraphicsSceneMock.mockReturnValue({ scene: null, status: "connected", setScene });
    render(<GraphicsControlPage />);
    fireEvent.click(screen.getByTestId("scene-btn-lowerThird"));
    expect(setScene).toHaveBeenCalledWith("lowerThird");
  });

  it("renders per-player scene buttons from the live graphics feed and marks the active one", () => {
    const setScene = vi.fn();
    useMatchStateMock.mockReturnValue({
      state: makeState({
        graphicsFeed: {
          provider: "championdata",
          sport: "netball",
          version: 1,
          capturedAt: new Date().toISOString(),
          stats: { team: { home: {}, visitor: {} }, players: [{ id: "p1", name: "Jamie Lee", team: "home", stats: {} }] },
        },
      }),
    });
    useGraphicsSceneMock.mockReturnValue({
      scene: { sceneType: "playerStatCard", payload: { playerId: "p1" }, updatedAt: new Date().toISOString() },
      status: "connected",
      setScene,
    });
    render(<GraphicsControlPage />);
    const statCardBtn = screen.getByTestId("scene-btn-statCard-p1");
    expect(statCardBtn).toHaveTextContent("Jamie Lee");

    const headshotBtn = screen.getByTestId("scene-btn-headshotBio-p1");
    fireEvent.click(headshotBtn);
    expect(setScene).toHaveBeenCalledWith("playerHeadshotBio", { playerId: "p1" });
  });

  it("clears the scene when Clear is clicked", () => {
    const setScene = vi.fn();
    useGraphicsSceneMock.mockReturnValue({
      scene: { sceneType: "lowerThird", updatedAt: new Date().toISOString() },
      status: "connected",
      setScene,
    });
    render(<GraphicsControlPage />);
    fireEvent.click(screen.getByTestId("scene-btn-clear"));
    expect(setScene).toHaveBeenCalledWith("");
  });
});
