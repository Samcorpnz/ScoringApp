import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MobileControl from "../page";
import { DEFAULT_MATCH_STATE, formatClock } from "../../../types";
import type { MatchState } from "@scorehub/types";

const {
  pushMock,
  useSessionMock,
  useMatchStateMock,
  useControlTokenMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useSessionMock: vi.fn(),
  useMatchStateMock: vi.fn(),
  useControlTokenMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

vi.mock("../../../hooks/useMatchState", () => ({
  useMatchState: useMatchStateMock,
}));

vi.mock("../../../hooks/useControlToken", () => ({
  useControlToken: useControlTokenMock,
}));

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return { ...DEFAULT_MATCH_STATE, ...overrides } as MatchState;
}

function makeMatchStateReturn(overrides: Record<string, unknown> = {}) {
  const sendManualUpdate = vi.fn();
  return {
    state: makeState(),
    status: "connected",
    feedStale: false,
    relayUnreachable: false,
    sendManualUpdate,
    sendReset: vi.fn(),
    estimateServerNow: () => Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  useControlTokenMock.mockReturnValue("mobile-secret");
  useSessionMock.mockReturnValue({ data: { user: { name: "Op" } }, status: "authenticated" });
  useMatchStateMock.mockReturnValue(makeMatchStateReturn());
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MobileControl", () => {
  it("redirects unauthenticated users to the mobile-specific login callback", () => {
    useSessionMock.mockImplementation((opts?: { onUnauthenticated?: () => void }) => {
      opts?.onUnauthenticated?.();
      return { data: null, status: "unauthenticated" };
    });
    render(<MobileControl />);
    expect(pushMock).toHaveBeenCalledWith("/login?callbackUrl=/control/mobile");
  });

  it("renders team names, scores, and the connection status", () => {
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({
      state: makeState({ home: { ...DEFAULT_MATCH_STATE.home, name: "Sharks", score: 12 }, visitor: { ...DEFAULT_MATCH_STATE.visitor, name: "Eagles", score: 9 } }),
    }));
    render(<MobileControl />);
    expect(screen.getByText("Sharks")).toBeInTheDocument();
    expect(screen.getByText("Eagles")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByTestId("connection-status")).toHaveTextContent("LIVE");
  });

  it("shows START when stopped and toggles isRunning with a click", () => {
    const sendManualUpdate = vi.fn();
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({
      state: makeState({ isRunning: false }),
      sendManualUpdate,
    }));
    render(<MobileControl />);
    const btn = screen.getByText(/START/);
    fireEvent.click(btn);
    expect(sendManualUpdate).toHaveBeenCalledWith(expect.objectContaining({ isRunning: true }));
  });

  it("shows STOP when running", () => {
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({ state: makeState({ isRunning: true }) }));
    render(<MobileControl />);
    expect(screen.getByText(/STOP/)).toBeInTheDocument();
  });

  it("increments the home score using a sport increment button", () => {
    const sendManualUpdate = vi.fn();
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({
      state: makeState({ sport: "netball", home: { ...DEFAULT_MATCH_STATE.home, score: 0 } }),
      sendManualUpdate,
    }));
    render(<MobileControl />);
    // netball's increments are [1, 2] — take the first "+1" button (home side)
    const plusOneButtons = screen.getAllByText("+1");
    fireEvent.click(plusOneButtons[0]);
    expect(sendManualUpdate).toHaveBeenCalledWith(expect.objectContaining({
      home: expect.objectContaining({ score: 1 }),
    }));
  });

  it("opens the set-time panel and applies a preset clock value", () => {
    const sendManualUpdate = vi.fn();
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({ sendManualUpdate }));
    render(<MobileControl />);
    fireEvent.click(screen.getByText(/Time/));
    fireEvent.click(screen.getByText("10m"));
    expect(sendManualUpdate).toHaveBeenCalledWith(expect.objectContaining({ clockSeconds: 600, isRunning: false }));
  });

  it("confirms before sending a reset", () => {
    const sendReset = vi.fn();
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({ sendReset }));
    render(<MobileControl />);
    fireEvent.click(screen.getByText("Reset Match"));
    expect(globalThis.confirm).toHaveBeenCalled();
    expect(sendReset).toHaveBeenCalled();
  });

  it("displays the formatted clock value", () => {
    useMatchStateMock.mockReturnValue(makeMatchStateReturn({ state: makeState({ clockSeconds: 125, isRunning: false }) }));
    render(<MobileControl />);
    expect(screen.getByText(formatClock(125))).toBeInTheDocument();
  });
});
