/**
 * relay/src/index.ts is a thin bootstrap: it initializes Sentry, wires up
 * process-level crash handlers, then dynamically imports ./server and
 * listens on PORT. There's no branching logic worth testing beyond "the
 * right pieces get called with the right config" and "crash handlers report
 * to Sentry" — so this mocks ./sentry and ./server and asserts wiring.
 */

const initSentryMock = jest.fn();
const captureExceptionMock = jest.fn();
jest.mock("../sentry", () => ({
  initSentry: (...a: unknown[]) => initSentryMock(...a),
  captureException: (...a: unknown[]) => captureExceptionMock(...a),
}));

const listenMock = jest.fn((_port: number, cb: () => void) => cb());
const createServerMock = jest.fn((..._a: unknown[]) => ({
  httpServer: { listen: listenMock },
}));
jest.mock("../server", () => ({
  createServer: (a: unknown) => createServerMock(a),
}));

describe("relay/src/index.ts bootstrap", () => {
  const originalEnv = { ...process.env };
  let uncaughtHandlers: Array<(...a: any[]) => void>;
  let unhandledHandlers: Array<(...a: any[]) => void>;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    initSentryMock.mockClear();
    captureExceptionMock.mockClear();
    createServerMock.mockClear();
    listenMock.mockClear();
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.UPLOAD_DIR;

    uncaughtHandlers = [];
    unhandledHandlers = [];
    processOnSpy = jest.spyOn(process, "on").mockImplementation(((event: string, handler: (...a: any[]) => void) => {
      if (event === "uncaughtException") uncaughtHandlers.push(handler);
      if (event === "unhandledRejection") unhandledHandlers.push(handler);
      return process;
    }) as any);
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    process.env = originalEnv;
  });

  it("initializes Sentry before importing the server module", async () => {
    require("../index");
    // main() is async; let its microtasks/dynamic import resolve.
    await new Promise(resolve => setImmediate(resolve));
    expect(initSentryMock).toHaveBeenCalledTimes(1);
    expect(createServerMock).toHaveBeenCalledTimes(1);
  });

  it("creates the server with the default port and upload dir when env vars are unset", async () => {
    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(createServerMock).toHaveBeenCalledWith(
      expect.objectContaining({ uploadDir: expect.stringContaining("uploads") }),
    );
    expect(listenMock).toHaveBeenCalledWith(4000, expect.any(Function));
  });

  it("honours PORT and UPLOAD_DIR env vars", async () => {
    process.env.PORT = "5123";
    process.env.UPLOAD_DIR = "/tmp/custom-uploads";

    require("../index");
    await new Promise(resolve => setImmediate(resolve));

    expect(createServerMock).toHaveBeenCalledWith({ uploadDir: "/tmp/custom-uploads" });
    expect(listenMock).toHaveBeenCalledWith(5123, expect.any(Function));
  });

  it("registers uncaughtException / unhandledRejection handlers that report to Sentry", () => {
    require("../index");

    expect(uncaughtHandlers).toHaveLength(1);
    expect(unhandledHandlers).toHaveLength(1);

    const err = new Error("boom");
    uncaughtHandlers[0](err);
    expect(captureExceptionMock).toHaveBeenCalledWith(err);

    const reason = "some rejection reason";
    unhandledHandlers[0](reason);
    expect(captureExceptionMock).toHaveBeenCalledWith(reason);
  });

  it("reports to Sentry and exits the process if createServer throws", async () => {
    createServerMock.mockImplementationOnce(() => {
      throw new Error("server init failed");
    });
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    require("../index");
    await new Promise(resolve => setImmediate(resolve));
    // allow the .catch() on main()'s returned promise to run
    await new Promise(resolve => setImmediate(resolve));

    expect(captureExceptionMock).toHaveBeenCalledWith(expect.objectContaining({ message: "server init failed" }));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
