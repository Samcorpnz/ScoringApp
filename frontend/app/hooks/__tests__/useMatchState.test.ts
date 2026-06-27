import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMatchState } from "../useMatchState";
import { DEFAULT_MATCH_STATE } from "../../types";

type Handler = (...args: any[]) => void;

function makeFakeSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    __trigger: (event: string, ...args: any[]) => {
      for (const cb of handlers[event] ?? []) cb(...args);
    },
  };
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;
const ioMock = vi.fn((..._args: unknown[]) => fakeSocket);

vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

describe("useMatchState", () => {
  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    ioMock.mockClear();
  });

  it("starts in the connecting state with default match state", () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    expect(result.current.status).toBe("connecting");
    expect(result.current.state).toEqual(DEFAULT_MATCH_STATE);
  });

  it("transitions to connected on the socket's connect event", async () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    act(() => fakeSocket.__trigger("connect"));
    await waitFor(() => expect(result.current.status).toBe("connected"));
  });

  it("transitions to disconnected on disconnect/connect_error", async () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    act(() => fakeSocket.__trigger("disconnect"));
    await waitFor(() => expect(result.current.status).toBe("disconnected"));
  });

  it("adopts an incoming matchStateChange with a newer sequenceId", async () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    const incoming = { ...DEFAULT_MATCH_STATE, sequenceId: 5, matchName: "Finals" };
    act(() => fakeSocket.__trigger("matchStateChange", incoming));
    await waitFor(() => expect(result.current.state.matchName).toBe("Finals"));
  });

  it("ignores a stale matchStateChange with an older sequenceId", async () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    act(() => fakeSocket.__trigger("matchStateChange", { ...DEFAULT_MATCH_STATE, sequenceId: 5, matchName: "Finals" }));
    await waitFor(() => expect(result.current.state.sequenceId).toBe(5));

    act(() => fakeSocket.__trigger("matchStateChange", { ...DEFAULT_MATCH_STATE, sequenceId: 1, matchName: "Stale" }));
    expect(result.current.state.matchName).toBe("Finals");
  });

  it("sendManualUpdate emits manualUpdate on the socket", () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    act(() => result.current.sendManualUpdate({ matchName: "New" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("manualUpdate", { matchName: "New" });
  });

  it("sendReset emits resetMatch on the socket", () => {
    const { result } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    act(() => result.current.sendReset());
    expect(fakeSocket.emit).toHaveBeenCalledWith("resetMatch");
  });

  it("authenticates with the supplied secret/role when provided", () => {
    renderHook(() => useMatchState({ secret: "top-secret", role: "control" }));
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { secret: "top-secret", role: "control" } })
    );
  });

  it("disconnects the socket on unmount", () => {
    const { unmount } = renderHook(() => useMatchState({ secret: "s", role: "control" }));
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });
});
