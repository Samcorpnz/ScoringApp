import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { SettingsTab } from "../SettingsTab";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("next-auth/react", () => ({
  useSession: useSessionMock,
}));

function makeState(): MatchState {
  return { ...DEFAULT_MATCH_STATE } as MatchState;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SettingsTab", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "OPERATOR", activeOrgId: undefined } } });
  });

  it("renders team colour, sport, and template sections", () => {
    render(<SettingsTab state={makeState()} push={vi.fn()} />);
    expect(screen.getByText("Home — Team Colour")).toBeInTheDocument();
    expect(screen.getByText("Visitor — Team Colour")).toBeInTheDocument();
    expect(screen.getByText("Sport")).toBeInTheDocument();
    expect(screen.getByText("Template Defaults — Netball")).toBeInTheDocument();
  });

  it("pushes an updated home color when a swatch is clicked", () => {
    const push = vi.fn();
    render(<SettingsTab state={makeState()} push={push} />);
    fireEvent.click(screen.getByText("Netball").closest("button")!);
    expect(push).toHaveBeenCalledWith({ sport: "netball" });
  });

  it("pushes the selected sport when a sport tile is clicked", () => {
    const push = vi.fn();
    render(<SettingsTab state={makeState()} push={push} />);
    fireEvent.click(screen.getByText("Basketball").closest("button")!);
    expect(push).toHaveBeenCalledWith({ sport: "basketball" });
  });

  it("applies template defaults when the button is clicked", () => {
    const push = vi.fn();
    render(<SettingsTab state={makeState()} push={push} />);
    fireEvent.click(screen.getByText("Apply Template Defaults"));
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ sport: "netball", period: "1", isRunning: false }));
  });

  it("does not render the End Match card without a matchId", () => {
    render(<SettingsTab state={makeState()} push={vi.fn()} />);
    expect(screen.queryByTestId("end-match")).not.toBeInTheDocument();
  });

  it("renders the End Match card when matchId is provided, and ends the match on confirm", async () => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "ADMIN", activeOrgId: "org1" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    const onEnded = vi.fn();
    render(<SettingsTab state={makeState()} push={vi.fn()} matchId="match1" onEnded={onEnded} />);
    fireEvent.click(screen.getByTestId("end-match"));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith("/api/orgs/org1/matches/match1/end", { method: "POST" });
  });

  it("does not end the match if the confirm dialog is dismissed", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "ADMIN", activeOrgId: "org1" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tokens: [] }) }));
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<SettingsTab state={makeState()} push={vi.fn()} matchId="match1" />);
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByTestId("end-match"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows an error message when ending the match fails", async () => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "ADMIN", activeOrgId: "org1" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Cannot end" }) }));
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    render(<SettingsTab state={makeState()} push={vi.fn()} matchId="match1" />);
    fireEvent.click(screen.getByTestId("end-match"));
    expect(await screen.findByText("Cannot end")).toBeInTheDocument();
  });

  it("does not render the webhook/bridge admin cards for an OPERATOR role", () => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "OPERATOR", activeOrgId: "org1" } } });
    render(<SettingsTab state={makeState()} push={vi.fn()} />);
    expect(screen.queryByText("Stream Deck / Webhooks")).not.toBeInTheDocument();
    expect(screen.queryByText("Bridge Devices")).not.toBeInTheDocument();
  });

  it("renders the webhook/bridge admin cards for a MANAGER role with an org", async () => {
    useSessionMock.mockReturnValue({ data: { user: { activeRole: "MANAGER", activeOrgId: "org1" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tokens: [] }) }));
    render(<SettingsTab state={makeState()} push={vi.fn()} />);
    expect(screen.getByText("Stream Deck / Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Bridge Devices")).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });
});
