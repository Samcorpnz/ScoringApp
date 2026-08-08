import { DEFAULT_MATCH_STATE } from "../../types";

type Handler = (...args: any[]) => unknown;

function makeFakePage() {
  const handlers: Record<string, Handler> = {};
  return {
    setRequestInterception: jest.fn(async () => {}),
    on: jest.fn((event: string, cb: Handler) => {
      handlers[event] = cb;
    }),
    goto: jest.fn(async () => {}),
    reload: jest.fn(async () => {}),
    isClosed: jest.fn(() => false),
    close: jest.fn(async () => {}),
    __trigger: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

function makeFakeBrowser(page: ReturnType<typeof makeFakePage>) {
  return {
    newPage: jest.fn(async () => page),
    close: jest.fn(async () => {}),
  };
}

let fakePage: ReturnType<typeof makeFakePage>;
let fakeBrowser: ReturnType<typeof makeFakeBrowser>;
const launchMock = jest.fn();

jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: (...a: unknown[]) => launchMock(...a) },
}));

// dns.lookup is consumed via util.promisify(dns.lookup) in the source module,
// which resolves to { address, family } only when the function carries
// Node's util.promisify.custom symbol (as the real dns.lookup does) — a
// plain (hostname, cb) mock would resolve to just the bare address string
// and silently break the address destructuring under test.
const dnsLookupMock = jest.fn();
jest.mock("node:dns", () => {
  const { promisify } = require("node:util");
  function lookup(hostname: string, cb: (err: Error | null, address?: string, family?: number) => void) {
    dnsLookupMock(hostname, cb);
  }
  (lookup as any)[promisify.custom] = (hostname: string) =>
    new Promise((resolve, reject) => {
      dnsLookupMock(hostname, (err: Error | null, address?: string, family?: number) =>
        err ? reject(err) : resolve({ address, family }),
      );
    });
  return { lookup };
});

const parseChampionDataJsonMock = jest.fn();
jest.mock("../../protocol/championDataParser", () => ({
  parseChampionDataJson: (...a: unknown[]) => parseChampionDataJsonMock(...a),
}));

import { startScrapeSource } from "../championDataScrapeSource";

async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

function makeSocket() {
  return { connected: true, emit: jest.fn() };
}

describe("startScrapeSource", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fakePage = makeFakePage();
    fakeBrowser = makeFakeBrowser(fakePage);
    launchMock.mockReset();
    launchMock.mockResolvedValue(fakeBrowser);
    dnsLookupMock.mockReset();
    dnsLookupMock.mockImplementation((hostname, cb) => cb(null, "203.0.113.5", 4));
    parseChampionDataJsonMock.mockReset();
    parseChampionDataJsonMock.mockReturnValue({ ...DEFAULT_MATCH_STATE });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws for a non-http(s) URL scheme without launching a browser", async () => {
    await expect(
      startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "ftp://example.com" }),
    ).rejects.toThrow(/http or https/);
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("throws for an unparseable URL", async () => {
    await expect(
      startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "not a url" }),
    ).rejects.toThrow(/not a valid URL/);
  });

  it("throws when the hostname is a private/loopback address", async () => {
    await expect(
      startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), { url: "http://10.0.0.5/match" }),
    ).rejects.toThrow(/private or loopback/);
  });

  it("launches the browser, navigates, and sets up request/response interception", async () => {
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true, args: expect.arrayContaining(["--no-sandbox"]) }),
    );
    expect(fakePage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(fakePage.goto).toHaveBeenCalledWith(
      "http://cd.example.com/match/1",
      expect.objectContaining({ waitUntil: "networkidle2" }),
    );
  });

  it("aborts image/stylesheet/font/media requests without checking target safety", async () => {
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const req = { resourceType: () => "image", abort: jest.fn(), continue: jest.fn(), url: () => "http://x/img.png" };
    fakePage.__trigger("request", req);
    expect(req.abort).toHaveBeenCalled();
    expect(req.continue).not.toHaveBeenCalled();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it("continues a document request whose target resolves to a safe address", async () => {
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const req = {
      resourceType: () => "document",
      abort: jest.fn(),
      continue: jest.fn(),
      url: () => "http://cd.example.com/api/data",
    };
    fakePage.__trigger("request", req);
    await flushMicrotasks();

    expect(req.continue).toHaveBeenCalled();
    expect(req.abort).not.toHaveBeenCalled();
  });

  it("aborts a document request whose target resolves to a private address (DNS rebinding)", async () => {
    dnsLookupMock.mockImplementation((hostname, cb) => cb(null, "127.0.0.1", 4));
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const req = {
      resourceType: () => "document",
      abort: jest.fn(),
      continue: jest.fn(),
      url: () => "http://cd.example.com/api/data",
    };
    fakePage.__trigger("request", req);
    await flushMicrotasks();

    expect(req.abort).toHaveBeenCalled();
    expect(req.continue).not.toHaveBeenCalled();
  });

  it("aborts a request whose URL fails to parse", async () => {
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const req = { resourceType: () => "document", abort: jest.fn(), continue: jest.fn(), url: () => "not a url" };
    fakePage.__trigger("request", req);
    await Promise.resolve();
    await Promise.resolve();

    expect(req.abort).toHaveBeenCalled();
  });

  it("captures a netball-shaped JSON response as the latest payload and uses it on the next poll", async () => {
    const setState = jest.fn();
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, {
      url: "http://cd.example.com/match/1",
      pollMs: 500,
    });

    const payload = { sport: { netballMatchStats: {} } };
    const response = { headers: () => ({ "content-type": "application/json" }), url: () => "x", json: async () => payload };
    await fakePage.__trigger("response", response);

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(parseChampionDataJsonMock).toHaveBeenCalledWith(payload, DEFAULT_MATCH_STATE);
    expect(setState).toHaveBeenCalled();
  });

  it("ignores a non-JSON content-type response", async () => {
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const response = { headers: () => ({ "content-type": "text/html" }), url: () => "x", json: async () => ({}) };
    await fakePage.__trigger("response", response);
    expect(parseChampionDataJsonMock).not.toHaveBeenCalled();
  });

  it("ignores a JSON response that isn't netball-shaped", async () => {
    const setState = jest.fn();
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, setState, {
      url: "http://cd.example.com/match/1",
      pollMs: 500,
    });

    const response = { headers: () => ({ "content-type": "application/json" }), url: () => "x", json: async () => ({ other: true }) };
    await fakePage.__trigger("response", response);

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(setState).not.toHaveBeenCalled();
  });

  it("warns and continues when a JSON response body fails to parse", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    const response = {
      headers: () => ({ "content-type": "application/json" }),
      url: () => "http://cd.example.com/api",
      json: async () => {
        throw new Error("bad json");
      },
    };
    await fakePage.__trigger("response", response);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse JSON response"));
    warnSpy.mockRestore();
  });

  it("emits stateUpdate on the socket when connected", async () => {
    const socket = makeSocket();
    await startScrapeSource(socket as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
      pollMs: 500,
    });

    await fakePage.__trigger("response", {
      headers: () => ({ "content-type": "application/json" }),
      url: () => "x",
      json: async () => ({ sport: { netballMatchStats: {} } }),
    });
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.emit).toHaveBeenCalledWith("stateUpdate", expect.any(Object));
  });

  it("relaunches the browser when a page reload fails", async () => {
    const errorLikePage = fakePage;
    errorLikePage.reload.mockRejectedValueOnce(new Error("reload failed"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
      pollMs: 500,
    });

    jest.advanceTimersByTime(500);
    await flushMicrotasks(10);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Reload failed"), expect.any(String));
    expect(launchMock).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("returned stop function tears down the page and browser", async () => {
    const stop = await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    await stop();
    expect(fakePage.close).toHaveBeenCalled();
    expect(fakeBrowser.close).toHaveBeenCalled();
  });

  it("stop() tolerates page.close()/browser.close() throwing", async () => {
    fakePage.close.mockRejectedValue(new Error("already closed"));
    const stop = await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
    });

    await expect(stop()).resolves.toBeUndefined();
  });

  it("clamps an out-of-range pollMs into [100, 60000]", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await startScrapeSource(makeSocket() as any, () => DEFAULT_MATCH_STATE, jest.fn(), {
      url: "http://cd.example.com/match/1",
      pollMs: 1,
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("100ms interval"));
    logSpy.mockRestore();
  });
});
