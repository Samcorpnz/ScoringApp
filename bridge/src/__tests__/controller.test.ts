import { BridgeController } from "../controller";

type Handler = (...args: any[]) => void;

function makeFakeSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    connected: true,
    on: jest.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
    __trigger: (event: string, ...args: any[]) => {
      for (const cb of handlers[event] ?? []) cb(...args);
    },
  };
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;
const ioMock = jest.fn((..._args: unknown[]) => fakeSocket);

jest.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

// These pull in node-fetch (ESM), which Jest can't parse — controller.test.ts
// only exercises the relay socket lifecycle, never these hardware/feed sources.
jest.mock("../sources/championDataJsonSource", () => ({ startJsonSource: jest.fn() }));
jest.mock("../sources/championDataScrapeSource", () => ({ startScrapeSource: jest.fn() }));

// SA-58: bridge surfaces a clear "relay unreachable" signal to the operator
// (rather than silently retrying forever) once a disconnect outlasts the
// outage-alert window, and recovers cleanly once the relay comes back.
describe("BridgeController relay health (SA-58)", () => {
  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    ioMock.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function startRelayOnly(): BridgeController {
    const controller = new BridgeController();
    // connectRelay is private — start() also boots a hardware/feed source
    // we don't have in tests, so we drive the relay socket lifecycle directly.
    (controller as any).connectRelay();
    return controller;
  }

  it("reports connected with no outage before any disconnect", () => {
    const controller = startRelayOnly();
    fakeSocket.__trigger("connect");

    expect(controller.getRelayHealth()).toEqual({
      connected: true,
      disconnectedSince: null,
      outageAlerted: false,
    });
  });

  it("does not alert an outage for a brief disconnect", () => {
    const controller = startRelayOnly();
    fakeSocket.connected = false;
    fakeSocket.__trigger("disconnect", "transport close");

    jest.advanceTimersByTime(30_000); // well under the 60s outage threshold

    const health = controller.getRelayHealth();
    expect(health.connected).toBe(false);
    expect(health.outageAlerted).toBe(false);
  });

  it("alerts an outage once disconnected for over 60s, visible via getRelayHealth", () => {
    const controller = startRelayOnly();
    fakeSocket.connected = false;
    fakeSocket.__trigger("disconnect", "transport close");

    jest.advanceTimersByTime(65_000);

    expect(controller.getRelayHealth().outageAlerted).toBe(true);
  });

  it("clears the outage alert and disconnectedSince on reconnect", () => {
    const controller = startRelayOnly();
    fakeSocket.connected = false;
    fakeSocket.__trigger("disconnect", "transport close");
    jest.advanceTimersByTime(65_000);
    expect(controller.getRelayHealth().outageAlerted).toBe(true);

    fakeSocket.connected = true;
    fakeSocket.__trigger("connect");

    expect(controller.getRelayHealth()).toEqual({
      connected: true,
      disconnectedSince: null,
      outageAlerted: false,
    });
  });
});
