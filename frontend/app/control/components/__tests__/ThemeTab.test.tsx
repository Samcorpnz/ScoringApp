import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ThemeTab } from "../ThemeTab";
import { DEFAULT_MATCH_STATE } from "../../../types";
import type { MatchState } from "@scorehub/types";

function makeState(): MatchState {
  return { ...DEFAULT_MATCH_STATE } as MatchState;
}

describe("ThemeTab — competition logo uploader", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(cleanup);

  it("uploads a competition logo and updates the theme", async () => {
    const push = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "",
      json: async () => ({ competitionLogoUrl: "/logos/comp.png" }),
    });

    render(<ThemeTab state={makeState()} push={push} controlToken="tok" />);

    const input = screen.getByTestId("competition-logo-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });

    await waitFor(() => expect(push).toHaveBeenCalled());

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/competition-logo");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-control-secret"]).toBe("tok");
    expect(push).toHaveBeenCalledWith({
      displayTheme: { ...DEFAULT_MATCH_STATE.displayTheme, competitionLogoUrl: "/logos/comp.png" },
    });
  });

  it("removes the competition logo", async () => {
    const push = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const state = {
      ...makeState(),
      displayTheme: { ...DEFAULT_MATCH_STATE.displayTheme, competitionLogoUrl: "/logos/comp.png" },
    };

    render(<ThemeTab state={state} push={push} controlToken="tok" />);

    fireEvent.click(screen.getByTestId("competition-logo-remove-button"));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({ displayTheme: { ...state.displayTheme, competitionLogoUrl: "" } })
    );

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/competition-logo");
    expect(opts.method).toBe("DELETE");
  });
});
