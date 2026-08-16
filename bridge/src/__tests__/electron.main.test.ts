/**
 * src/electron/main.ts runs its whole setup as a side effect of being
 * imported (see `main().catch(...)` at the bottom of that file), so these
 * tests mock "electron" plus ../controller and ../ui/server, require the
 * module once per test via jest.isolateModulesAsync, and assert against the
 * fakes rather than calling exported functions (there are none to call).
 */

type MenuTemplateItem = {
  label?: string;
  type?: string;
  checked?: boolean;
  click?: (menuItem: { checked: boolean }) => void | Promise<void>;
};

const windowInstances: FakeBrowserWindow[] = [];
const trayInstances: FakeTray[] = [];
const appListeners: Record<string, Array<() => void>> = {};

class FakeBrowserWindow {
  static getAllWindows = jest.fn(() => windowInstances);
  loadURL = jest.fn().mockResolvedValue(undefined);
  show = jest.fn();
  hide = jest.fn();
  private handlers: Record<string, Array<(...args: any[]) => void>> = {};

  constructor(public opts: unknown) {
    windowInstances.push(this);
  }

  on(event: string, handler: (...args: any[]) => void) {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const h of this.handlers[event] ?? []) h(...args);
  }
}

class FakeTray {
  setToolTip = jest.fn();
  setContextMenu = jest.fn();
  on = jest.fn();
  constructor(public icon: unknown) {
    trayInstances.push(this);
  }
}

const buildFromTemplate = jest.fn((template: MenuTemplateItem[]) => ({ __template: template }));

let loginItemSettings = { openAtLogin: false };
const setLoginItemSettings = jest.fn((settings: { openAtLogin: boolean }) => {
  loginItemSettings = settings;
});

const fakeApp = {
  whenReady: jest.fn().mockResolvedValue(undefined),
  getPath: jest.fn().mockReturnValue("/fake/userData"),
  getLoginItemSettings: jest.fn(() => loginItemSettings),
  setLoginItemSettings,
  quit: jest.fn(),
  on: jest.fn((event: string, handler: () => void) => {
    (appListeners[event] ??= []).push(handler);
  }),
};

jest.mock("electron", () => ({
  app: fakeApp,
  BrowserWindow: FakeBrowserWindow,
  Tray: FakeTray,
  Menu: { buildFromTemplate },
  nativeImage: { createFromPath: jest.fn() },
}));

const fakeController = {
  status: "stopped" as string,
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};
const ElectronBridgeControllerMock = jest.fn(() => fakeController);
jest.mock("../controller", () => ({ BridgeController: ElectronBridgeControllerMock }));

const createUiServer = jest.fn();
jest.mock("../ui/server", () => ({ createUiServer }));

async function loadMain(): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    require("../electron/main");
    // Flush the microtask queue so the top-level `main().catch(...)` (which
    // awaits app.whenReady(), dynamic imports, and window/tray setup) settles
    // before assertions run.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });
}

function getTrayMenuTemplate(): MenuTemplateItem[] {
  const lastCall = buildFromTemplate.mock.calls.at(-1);
  if (!lastCall) throw new Error("Menu.buildFromTemplate was never called");
  return lastCall[0] as MenuTemplateItem[];
}

describe("electron/main", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    windowInstances.length = 0;
    trayInstances.length = 0;
    for (const key of Object.keys(appListeners)) delete appListeners[key];
    loginItemSettings = { openAtLogin: false };
    fakeController.status = "stopped";
    delete process.env.CD_AUTOSTART;
  });

  it("sets BRIDGE_CONFIG_DIR from app.getPath('userData') before the controller is imported", async () => {
    await loadMain();
    expect(fakeApp.getPath).toHaveBeenCalledWith("userData");
    expect(process.env.BRIDGE_CONFIG_DIR).toBe("/fake/userData");
  });

  it("starts the existing UI server and opens a window pointed at it", async () => {
    await loadMain();
    expect(ElectronBridgeControllerMock).toHaveBeenCalledTimes(1);
    expect(createUiServer).toHaveBeenCalledWith(fakeController, 4002);
    expect(windowInstances).toHaveLength(1);
    expect(windowInstances[0].loadURL).toHaveBeenCalledWith("http://localhost:4002");
  });

  it("creates a tray with a context menu", async () => {
    await loadMain();
    expect(trayInstances).toHaveLength(1);
    expect(trayInstances[0].setContextMenu).toHaveBeenCalled();
  });

  it("closing the window hides it instead of quitting", async () => {
    await loadMain();
    const win = windowInstances[0];
    const closeEvent = { preventDefault: jest.fn() };
    win.emit("close", closeEvent);
    expect(closeEvent.preventDefault).toHaveBeenCalled();
    expect(win.hide).toHaveBeenCalled();
  });

  it("does not autostart the bridge by default", async () => {
    await loadMain();
    expect(fakeController.start).not.toHaveBeenCalled();
  });

  it("autostarts the bridge when CD_AUTOSTART=true", async () => {
    process.env.CD_AUTOSTART = "true";
    await loadMain();
    expect(fakeController.start).toHaveBeenCalledTimes(1);
  });

  it("tray menu offers Start bridge when stopped, and starting it rebuilds the menu", async () => {
    fakeController.status = "stopped";
    await loadMain();
    const template = getTrayMenuTemplate();
    const startItem = template.find((i) => i.label === "Start bridge");
    expect(startItem).toBeDefined();

    await startItem!.click!({ checked: false });
    expect(fakeController.start).toHaveBeenCalledTimes(1);
    expect(trayInstances[0].setContextMenu).toHaveBeenCalledTimes(2);
  });

  it("tray menu offers Stop bridge when running, and stopping it calls controller.stop", async () => {
    fakeController.status = "running";
    await loadMain();
    const template = getTrayMenuTemplate();
    const stopItem = template.find((i) => i.label === "Stop bridge");
    expect(stopItem).toBeDefined();

    await stopItem!.click!({ checked: false });
    expect(fakeController.stop).toHaveBeenCalledTimes(1);
  });

  it("Launch at login checkbox reflects current setting and toggling it calls setLoginItemSettings", async () => {
    loginItemSettings = { openAtLogin: true };
    await loadMain();
    const template = getTrayMenuTemplate();
    const loginItem = template.find((i) => i.label === "Launch at login");
    expect(loginItem?.checked).toBe(true);

    loginItem!.click!({ checked: false });
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
  });

  it("Quit sets isQuitting so a subsequent window close is not intercepted, and calls app.quit()", async () => {
    await loadMain();
    const template = getTrayMenuTemplate();
    const quitItem = template.find((i) => i.label === "Quit");

    quitItem!.click!({ checked: false });
    expect(fakeApp.quit).toHaveBeenCalledTimes(1);

    const win = windowInstances[0];
    const closeEvent = { preventDefault: jest.fn() };
    win.emit("close", closeEvent);
    expect(closeEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("registers a before-quit handler that also sets isQuitting", async () => {
    await loadMain();
    expect(appListeners["before-quit"]).toBeDefined();
    appListeners["before-quit"][0]();

    const win = windowInstances[0];
    const closeEvent = { preventDefault: jest.fn() };
    win.emit("close", closeEvent);
    expect(closeEvent.preventDefault).not.toHaveBeenCalled();
  });
});
