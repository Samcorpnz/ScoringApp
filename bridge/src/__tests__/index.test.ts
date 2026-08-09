/**
 * bridge/src/index.ts is a thin bootstrap: init Sentry, wire process-level
 * crash handlers, construct a BridgeController, start the admin UI server,
 * and (only when CD_AUTOSTART=true) auto-start the configured source. The
 * one branch worth covering is that CD_AUTOSTART gate — everything else is
 * "the right modules get called with the right args".
 */

const initSentryMock = jest.fn();
const captureExceptionMock = jest.fn();
jest.mock("../sentry", () => ({
  initSentry: (...a: unknown[]) => initSentryMock(...a),
  captureException: (...a: unknown[]) => captureExceptionMock(...a),
}));

const logInfoMock = jest.fn();
jest.mock("../logger", () => ({
  log: { info: (...a: unknown[]) => logInfoMock(...a) },
}));

const startMock = jest.fn(async () => {});
const getConfigMock = jest.fn(() => ({ source: "saturn", relayUrl: "http://localhost:4000" }));
const BridgeControllerMock = jest.fn().mockImplementation(() => ({
  getConfig: getConfigMock,
  start: startMock,
}));
jest.mock("../controller", () => ({
  BridgeController: BridgeControllerMock,
}));

const createUiServerMock = jest.fn();
jest.mock("../ui/server", () => ({
  createUiServer: (...a: unknown[]) => createUiServerMock(...a),
}));

describe("bridge/src/index.ts bootstrap", () => {
  const originalEnv = { ...process.env };
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    initSentryMock.mockClear();
    captureExceptionMock.mockClear();
    logInfoMock.mockClear();
    startMock.mockClear();
    getConfigMock.mockClear();
    BridgeControllerMock.mockClear();
    createUiServerMock.mockClear();
    process.env = { ...originalEnv };
    delete process.env.UI_PORT;
    delete process.env.CD_AUTOSTART;
    processOnSpy = jest.spyOn(process, "on").mockImplementation((() => process) as any);
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    process.env = originalEnv;
  });

  it("initializes Sentry, constructs a controller and starts the UI server on the default port", async () => {
    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(initSentryMock).toHaveBeenCalledTimes(1);
    expect(BridgeControllerMock).toHaveBeenCalledTimes(1);
    expect(createUiServerMock).toHaveBeenCalledWith(expect.any(Object), 4002);
  });

  it("honours the UI_PORT env var", async () => {
    process.env.UI_PORT = "9999";
    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(createUiServerMock).toHaveBeenCalledWith(expect.any(Object), 9999);
  });

  it("does not auto-start the source when CD_AUTOSTART is unset", async () => {
    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(startMock).not.toHaveBeenCalled();
  });

  it("does not auto-start the source when CD_AUTOSTART is not exactly 'true'", async () => {
    process.env.CD_AUTOSTART = "1";
    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(startMock).not.toHaveBeenCalled();
  });

  it("auto-starts the source when CD_AUTOSTART=true", async () => {
    process.env.CD_AUTOSTART = "true";
    require("../index");
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("registers uncaughtException / unhandledRejection handlers that report to Sentry", () => {
    const handlers: Record<string, (...a: any[]) => void> = {};
    processOnSpy.mockImplementation(((event: string, cb: (...a: any[]) => void) => {
      handlers[event] = cb;
      return process;
    }) as any);

    require("../index");

    const err = new Error("boom");
    handlers["uncaughtException"](err);
    expect(captureExceptionMock).toHaveBeenCalledWith(err);

    const reason = "some rejection";
    handlers["unhandledRejection"](reason);
    expect(captureExceptionMock).toHaveBeenCalledWith(reason);
  });

  it("reports to Sentry and exits the process if the controller construction throws", async () => {
    BridgeControllerMock.mockImplementationOnce(() => {
      throw new Error("controller init failed");
    });
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    require("../index");
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(captureExceptionMock).toHaveBeenCalledWith(expect.objectContaining({ message: "controller init failed" }));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
