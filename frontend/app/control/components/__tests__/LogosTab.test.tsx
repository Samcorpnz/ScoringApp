import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LogosTab } from "../LogosTab";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

function makeState(): MatchState {
  return { ...DEFAULT_MATCH_STATE } as MatchState;
}

describe("LogosTab", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(cleanup);

  it("uploads a home team logo and pushes the returned logoUrl", async () => {
    const push = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "",
      json: async () => ({ logoUrl: "/logos/home.png" }),
    });

    render(<LogosTab state={makeState()} push={push} controlToken="tok" />);

    const input = screen.getByTestId("logo-home-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });

    await waitFor(() => expect(push).toHaveBeenCalled());

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/logo/home");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-control-secret"]).toBe("tok");
    expect(push).toHaveBeenCalledWith({ home: { ...DEFAULT_MATCH_STATE.home, logoUrl: "/logos/home.png" } });
  });

  it("removes the visitor team logo and pushes an empty logoUrl", async () => {
    const push = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const state = { ...makeState(), visitor: { ...DEFAULT_MATCH_STATE.visitor, logoUrl: "/logos/visitor.png" } };

    render(<LogosTab state={state} push={push} controlToken="tok" />);

    fireEvent.click(screen.getByTestId("logo-visitor-remove-button"));

    await waitFor(() => expect(push).toHaveBeenCalledWith({ visitor: { ...state.visitor, logoUrl: "" } }));

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/logo/visitor");
    expect(opts.method).toBe("DELETE");
  });
});
