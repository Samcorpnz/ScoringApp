import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGraphicsToken } from "../useGraphicsToken";

describe("useGraphicsToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in the loading state", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGraphicsToken("m1"));
    expect(result.current.status).toBe("loading");
    expect(result.current.token).toBe("");
  });

  it("fetches /api/graphics-token with the matchId and adopts the returned token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: "tok-abc" }) });
    const { result } = renderHook(() => useGraphicsToken("m1"));
    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.token).toBe("tok-abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/graphics-token?matchId=m1");
  });

  it("omits the matchId query param when no matchId is given", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: "tok-abc" }) });
    renderHook(() => useGraphicsToken());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/graphics-token"));
  });

  it("surfaces 'forbidden' on a 403 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { result } = renderHook(() => useGraphicsToken("m1"));
    await waitFor(() => expect(result.current.status).toBe("forbidden"));
  });

  it("surfaces 'error' on other non-ok responses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() => useGraphicsToken("m1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("keeps the existing token/status on a network error rather than clearing it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: "tok-abc" }) });
    const { result, rerender } = renderHook(() => useGraphicsToken("m1"));
    await waitFor(() => expect(result.current.status).toBe("ok"));

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    rerender();
    await Promise.resolve();
    expect(result.current.status).toBe("ok");
    expect(result.current.token).toBe("tok-abc");
  });

  it("refetches when matchId changes", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: "tok-abc" }) });
    const { rerender } = renderHook(({ matchId }) => useGraphicsToken(matchId), {
      initialProps: { matchId: "m1" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/graphics-token?matchId=m1"));

    rerender({ matchId: "m2" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/graphics-token?matchId=m2"));
  });
});
