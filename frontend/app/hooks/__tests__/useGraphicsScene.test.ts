import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGraphicsScene } from "../useGraphicsScene";

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

describe("useGraphicsScene", () => {
  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    ioMock.mockClear();
  });

  it("starts connecting with no scene", () => {
    const { result } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    expect(result.current.status).toBe("connecting");
    expect(result.current.scene).toBeNull();
  });

  it("authenticates with the supplied secret/role", () => {
    renderHook(() => useGraphicsScene({ secret: "top-secret", role: "graphics" }));
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { secret: "top-secret", role: "graphics" } }),
    );
  });

  it("transitions to connected on the socket's connect event", async () => {
    const { result } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    act(() => fakeSocket.__trigger("connect"));
    await waitFor(() => expect(result.current.status).toBe("connected"));
  });

  it("transitions to disconnected on disconnect/connect_error", async () => {
    const { result } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    act(() => fakeSocket.__trigger("connect_error"));
    await waitFor(() => expect(result.current.status).toBe("disconnected"));
  });

  it("adopts an incoming graphicsSceneUpdate", async () => {
    const { result } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    const incoming = { sceneType: "lineup", payload: { teamId: "t1" }, updatedAt: "2026-08-08T00:00:00Z" };
    act(() => fakeSocket.__trigger("graphicsSceneUpdate", incoming));
    await waitFor(() => expect(result.current.scene).toEqual(incoming));
  });

  it("setScene emits setScene with sceneType and payload", () => {
    const { result } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    act(() => result.current.setScene("lineup", { teamId: "t1" }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("setScene", { sceneType: "lineup", payload: { teamId: "t1" } });
  });

  it("disconnects the socket on unmount", () => {
    const { unmount } = renderHook(() => useGraphicsScene({ secret: "s", role: "control" }));
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it("connects unauthenticated with an empty auth payload when no auth and no window org param", () => {
    renderHook(() => useGraphicsScene());
    expect(ioMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ auth: {} }));
  });

  it("derives orgId/matchId from the URL query params when unauthenticated", () => {
    const original = window.location.href;
    window.history.pushState({}, "", "/display/graphics?org=org-1&matchId=m1");
    renderHook(() => useGraphicsScene());
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { orgId: "org-1", matchId: "m1" } }),
    );
    window.history.pushState({}, "", original);
  });
});
