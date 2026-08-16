import path from "node:path";
import fs from "node:fs";

// These pull in node-fetch (ESM), which Jest can't parse — same mocks as
// controller.test.ts/controller.lifecycle.test.ts.
jest.mock("../sources/championDataJsonSource", () => ({ startJsonSource: jest.fn() }));
jest.mock("../sources/championDataScrapeSource", () => ({ startScrapeSource: jest.fn() }));
jest.mock("socket.io-client", () => ({ io: jest.fn(() => ({ on: jest.fn(), emit: jest.fn(), connected: false })) }));

// CONFIG_PATH is computed once at module load from BRIDGE_CONFIG_DIR (falling
// back to cwd), so each case needs a fresh module instance — see
// electron/main.ts, which sets BRIDGE_CONFIG_DIR before ../controller loads.
describe("controller config path", () => {
  const ORIGINAL_ENV = process.env.BRIDGE_CONFIG_DIR;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BRIDGE_CONFIG_DIR;
    else process.env.BRIDGE_CONFIG_DIR = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it("persists to BRIDGE_CONFIG_DIR/bridge-config.json when set (Electron userData path)", () => {
    process.env.BRIDGE_CONFIG_DIR = "/fake/userData";

    jest.isolateModules(() => {
      const writeFileSync = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      const { BridgeController } = require("../controller");
      const controller = new BridgeController();
      controller.updateConfig({ relayUrl: "http://x" });

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join("/fake/userData", "bridge-config.json"),
        expect.any(String),
      );
    });
  });

  it("falls back to process.cwd()/bridge-config.json when BRIDGE_CONFIG_DIR is unset", () => {
    delete process.env.BRIDGE_CONFIG_DIR;

    jest.isolateModules(() => {
      const writeFileSync = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      const { BridgeController } = require("../controller");
      const controller = new BridgeController();
      controller.updateConfig({ relayUrl: "http://x" });

      expect(writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "bridge-config.json"),
        expect.any(String),
      );
    });
  });
});
