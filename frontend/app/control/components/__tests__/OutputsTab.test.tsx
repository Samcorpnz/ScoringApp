import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OutputsTab } from "../OutputsTab";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OutputsTab", () => {
  it("renders a card for each display output with the matchId/org query params applied", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeOrgId: "org1" } } });
    render(<OutputsTab matchId="match1" />);
    expect(screen.getByText("Fullscreen")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("Lower-Third Overlay")).toBeInTheDocument();
    expect(screen.getByText("Scorebug")).toBeInTheDocument();
    expect(
      screen.getByText((_content, el) => el?.textContent === "http://localhost:3000/display/fullscreen?org=org1&matchId=match1")
    ).toBeInTheDocument();
  });

  it("renders URLs without query params when there is no org or match", () => {
    useSessionMock.mockReturnValue({ data: null });
    render(<OutputsTab />);
    expect(
      screen.getByText((_content, el) => el?.textContent === "http://localhost:3000/display/fullscreen")
    ).toBeInTheDocument();
  });

  it("opens a pop-out window when Pop Out is clicked", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeOrgId: "org1" } } });
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    render(<OutputsTab matchId="match1" />);
    fireEvent.click(screen.getAllByText("↗ Pop Out")[0]);
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining("/display/fullscreen?org=org1&matchId=match1"),
      "scoreboard-Fullscreen",
      expect.stringContaining("width=1920,height=1080")
    );
  });

  it("copies the URL to the clipboard when Copy URL is clicked", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeOrgId: "org1" } } });
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<OutputsTab matchId="match1" />);
    fireEvent.click(screen.getAllByText("Copy URL")[0]);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/display/fullscreen?org=org1&matchId=match1"));
  });

  it("renders the Graphics Control and Player Roster links scoped to the matchId", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeOrgId: "org1" } } });
    render(<OutputsTab matchId="match1" />);
    expect(screen.getByText("Graphics Control").closest("a")).toHaveAttribute("href", "/control/graphics?matchId=match1");
    expect(screen.getByText("Player Roster").closest("a")).toHaveAttribute("href", "/control/roster?matchId=match1");
  });

  it("renders the Graphics links without matchId query when matchId is absent", () => {
    useSessionMock.mockReturnValue({ data: null });
    render(<OutputsTab />);
    expect(screen.getByText("Graphics Control").closest("a")).toHaveAttribute("href", "/control/graphics");
  });

  it("renders the data feed rows with copy buttons", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeOrgId: "org1" } } });
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<OutputsTab matchId="match1" />);
    expect(screen.getByText("REST snapshot")).toBeInTheDocument();
    expect(screen.getByText("WebSocket (Socket.io)")).toBeInTheDocument();
    expect(screen.getByText("matchStateChange")).toBeInTheDocument();
    const copyButtons = screen.getAllByText("Copy");
    fireEvent.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalled();
  });
});
