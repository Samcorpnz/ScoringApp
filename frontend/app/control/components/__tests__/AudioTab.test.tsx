import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AudioTab } from "../AudioTab";
import type { SoundCue } from "../../../hooks/useSoundCues";

afterEach(cleanup);

function makeCue(overrides: Partial<SoundCue> = {}): SoundCue {
  return {
    id: "cue-1",
    label: "2-min warning",
    period: "1",
    clockSeconds: 120,
    soundUrl: "http://localhost:4000/sounds/foo.mp3",
    filename: "foo.mp3",
    serverFilename: "foo.mp3",
    ...overrides,
  };
}

describe("AudioTab", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // jsdom doesn't implement audio playback
    vi.stubGlobal(
      "Audio",
      vi.fn().mockImplementation(function AudioMock(this: { play: () => Promise<void> }) {
        this.play = vi.fn().mockResolvedValue(undefined);
      })
    );
    vi.stubGlobal("crypto", { randomUUID: () => "abc-123" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state when there are no cues", () => {
    render(<AudioTab cues={[]} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);
    expect(screen.getByText("No cues configured. Add one above.")).toBeInTheDocument();
    expect(screen.getByText("Sound Cues (0)")).toBeInTheDocument();
  });

  it("lists existing cues sorted by clockSeconds descending", () => {
    const cues = [makeCue({ id: "a", clockSeconds: 30, label: "First" }), makeCue({ id: "b", clockSeconds: 90, label: "Second" })];
    render(<AudioTab cues={cues} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);
    const rendered = screen.getAllByText(/First|Second/).map(el => el.textContent);
    expect(rendered).toEqual(["Second", "First"]);
  });

  it("shows a validation error when adding a cue without a clock time", async () => {
    render(<AudioTab cues={[]} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);
    fireEvent.click(screen.getByTestId("sound-add-cue"));
    await waitFor(() => expect(screen.getByTestId("sound-error")).toHaveTextContent("Enter a valid time"));
  });

  it("shows a validation error when adding a cue without a file", async () => {
    render(<AudioTab cues={[]} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);
    fireEvent.change(screen.getByPlaceholderText("02:00"), { target: { value: "01:30" } });
    fireEvent.click(screen.getByTestId("sound-add-cue"));
    await waitFor(() => expect(screen.getByTestId("sound-error")).toHaveTextContent("Select an audio file"));
  });

  it("uploads the file and calls addCue with the returned metadata", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ filename: "server-name.mp3", originalName: "foo.mp3", url: "/sounds/server-name.mp3" }),
    });
    const addCue = vi.fn();
    render(<AudioTab cues={[]} addCue={addCue} removeCue={vi.fn()} controlToken="tok" />);

    fireEvent.change(screen.getByPlaceholderText("e.g. 2-minute warning"), { target: { value: "My Cue" } });
    fireEvent.change(screen.getByPlaceholderText("02:00"), { target: { value: "01:00" } });
    const file = new File(["x"], "foo.mp3", { type: "audio/mp3" });
    fireEvent.change(screen.getByTestId("sound-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("sound-add-cue"));

    await waitFor(() => expect(addCue).toHaveBeenCalled());
    const cueArg = addCue.mock.calls[0][0];
    expect(cueArg.label).toBe("My Cue");
    expect(cueArg.clockSeconds).toBe(60);
    expect(cueArg.soundUrl).toBe("http://localhost:4000/sounds/server-name.mp3");

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/sound");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-control-secret"]).toBe("tok");
  });

  it("shows an error message when the upload fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, text: async () => "upload failed" });
    render(<AudioTab cues={[]} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);

    fireEvent.change(screen.getByPlaceholderText("02:00"), { target: { value: "01:00" } });
    const file = new File(["x"], "foo.mp3", { type: "audio/mp3" });
    fireEvent.change(screen.getByTestId("sound-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("sound-add-cue"));

    await waitFor(() => expect(screen.getByTestId("sound-error")).toHaveTextContent("Error: upload failed"));
  });

  it("plays a cue via the Audio API when the test button is clicked", () => {
    const cue = makeCue();
    render(<AudioTab cues={[cue]} addCue={vi.fn()} removeCue={vi.fn()} controlToken="tok" />);
    fireEvent.click(screen.getByTestId(`sound-cue-test-${cue.id}`));
    expect(global.Audio).toHaveBeenCalledWith(cue.soundUrl);
  });

  it("removes a cue: deletes on the server via serverFilename and calls removeCue", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const removeCue = vi.fn();
    const cue = makeCue();
    render(<AudioTab cues={[cue]} addCue={vi.fn()} removeCue={removeCue} controlToken="tok" />);
    fireEvent.click(screen.getByTestId(`sound-cue-remove-${cue.id}`));

    await waitFor(() => expect(removeCue).toHaveBeenCalledWith(cue.id));
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`http://localhost:4000/api/sound/${cue.serverFilename}`);
    expect(opts.method).toBe("DELETE");
  });

  it("falls back to parsing the URL for legacy cues without serverFilename", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const removeCue = vi.fn();
    const cue = makeCue({ serverFilename: undefined, soundUrl: "http://localhost:4000/sounds/legacy.mp3" });
    render(<AudioTab cues={[cue]} addCue={vi.fn()} removeCue={removeCue} controlToken="tok" />);
    fireEvent.click(screen.getByTestId(`sound-cue-remove-${cue.id}`));

    await waitFor(() => expect(removeCue).toHaveBeenCalledWith(cue.id));
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/sound/legacy.mp3");
  });
});
