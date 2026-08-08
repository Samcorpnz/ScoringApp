import { DEFAULT_MATCH_STATE } from "../../types";

const fetchMock = jest.fn();
jest.mock("node-fetch", () => ({
  __esModule: true,
  default: (...a: unknown[]) => fetchMock(...a),
}));

const parseChampionDataJsonMock = jest.fn();
jest.mock("../../protocol/championDataParser", () => ({
  parseChampionDataJson: (...a: unknown[]) => parseChampionDataJsonMock(...a),
}));

const findFeedMappingMock = jest.fn();
jest.mock("../../graphics/feedMappingRegistry", () => ({
  findFeedMapping: (...a: unknown[]) => findFeedMappingMock(...a),
}));

const buildGraphicsFeedMock = jest.fn();
jest.mock("../../graphics/feedTransform", () => ({
  buildGraphicsFeed: (...a: unknown[]) => buildGraphicsFeedMock(...a),
}));

import { startJsonSource } from "../championDataJsonSource";

function makeSocket() {
  return { connected: true, emit: jest.fn() };
}

describe("startJsonSource", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    parseChampionDataJsonMock.mockReset();
    findFeedMappingMock.mockReset();
    buildGraphicsFeedMock.mockReset();
    parseChampionDataJsonMock.mockReturnValue({ ...DEFAULT_MATCH_STATE });
    findFeedMappingMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws for a non-http(s) URL scheme", () => {
    expect(() =>
      startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "ftp://example.com/feed" }),
    ).toThrow(/http or https/);
  });

  it("throws for a URL that isn't parseable at all", () => {
    expect(() =>
      startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "not a url" }),
    ).toThrow(/not a valid URL/);
  });

  it("throws when the hostname is a private/loopback address", () => {
    expect(() =>
      startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
        url: "http://192.168.1.5/feed",
      }),
    ).toThrow(/private or loopback/);
  });

  it("throws for the cloud metadata link-local address", () => {
    expect(() =>
      startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
        url: "http://169.254.169.254/latest/meta-data",
      }),
    ).toThrow(/private or loopback/);
  });

  it("polls the URL, parses the response, and pushes state via setState + socket.emit", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ some: "payload" }) });
    const setState = jest.fn();
    const socket = makeSocket();

    startJsonSource(socket as any, () => DEFAULT_MATCH_STATE, setState, { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://cd.example.com/feed",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ ...DEFAULT_MATCH_STATE }));
    expect(socket.emit).toHaveBeenCalledWith("stateUpdate", expect.any(Object));
  });

  it("does not emit when the socket is disconnected", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const setState = jest.fn();
    const socket = { connected: false, emit: jest.fn() };

    startJsonSource(socket as any, () => DEFAULT_MATCH_STATE, setState, { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(setState).toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("adds a Basic auth header when username+password are supplied", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/feed",
      username: "user",
      password: "pass",
    });
    await Promise.resolve();
    await Promise.resolve();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );
  });

  it("does not set an Authorization header when credentials are absent", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("logs a warning and skips setState on a non-ok HTTP response", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const setState = jest.fn();

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(setState).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("503"));
    warnSpy.mockRestore();
  });

  it("logs an error and keeps polling when fetch rejects", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const setState = jest.fn();

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, {
      url: "http://cd.example.com/feed",
      pollMs: 100,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("network down"));

    jest.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();
    expect(setState).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("stops polling once the returned stop function is called", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const stop = startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/feed",
      pollMs: 100,
    });
    await Promise.resolve();
    await Promise.resolve();
    const callsBeforeStop = fetchMock.mock.calls.length;

    stop();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(fetchMock.mock.calls.length).toBe(callsBeforeStop);
  });

  it("clamps an out-of-range pollMs into [100, 60000]", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/feed",
      pollMs: 1,
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("every 100ms"));
    logSpy.mockRestore();
  });

  it("falls back to the default pollMs when NaN is supplied", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/feed",
      pollMs: Number.NaN,
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("every 2000ms"));
    logSpy.mockRestore();
  });

  it("merges a graphics feed onto parsed state when a provider mapping is found", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ raw: true }) });
    findFeedMappingMock.mockReturnValue({ provider: "championdata", sport: "netball" });
    buildGraphicsFeedMock.mockReturnValue({ sceneType: "lineup", updatedAt: "now", version: 1 });
    const setState = jest.fn();

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ graphicsFeed: { sceneType: "lineup", updatedAt: "now", version: 1 } }),
    );
  });

  it("swallows a graphics-mapping error and keeps the previous graphicsFeed rather than failing the poll", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    findFeedMappingMock.mockImplementation(() => {
      throw new Error("bad mapping");
    });
    const setState = jest.fn();

    startJsonSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, { url: "http://cd.example.com/feed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(setState).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("graphics feed mapping error"));
    errorSpy.mockRestore();
  });
});
