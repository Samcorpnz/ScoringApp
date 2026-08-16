/**
 * ScoreHub Bridge — Electron shell.
 *
 * Wraps the existing bridge/src/ui Express admin UI in a native desktop app:
 * a BrowserWindow pointed at the local UI server, a tray icon so the bridge
 * keeps relaying after the window is closed, and a "launch at login" toggle.
 * The server/controller code (src/controller.ts, src/ui/server.ts) is reused
 * unchanged — see index.ts for the headless/CLI equivalent of this entry point.
 */

import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import path from "node:path";
import type { BridgeController } from "../controller";

const UI_PORT = Number.parseInt(process.env.UI_PORT ?? "4002", 10);

// Must be set before ../controller (which reads it once at module load) is
// imported — a packaged app has no predictable process.cwd() to persist
// bridge-config.json into.
process.env.BRIDGE_CONFIG_DIR = app.getPath("userData");

const ICON_DIR = path.join(__dirname, "../../resources");

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 820,
    title: "ScoreHub Bridge",
    icon: path.join(ICON_DIR, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`http://localhost:${UI_PORT}`);

  // Closing the window must not stop the bridge mid-event — it keeps running
  // in the tray until "Quit" is chosen explicitly.
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
}

function buildTrayMenu(controller: BridgeController): Menu {
  const running = controller.status === "running" || controller.status === "connecting";
  return Menu.buildFromTemplate([
    {
      label: "Show ScoreHub Bridge",
      click: () => mainWindow?.show(),
    },
    { type: "separator" },
    {
      label: running ? "Stop bridge" : "Start bridge",
      click: async () => {
        if (running) await controller.stop();
        else await controller.start();
        tray?.setContextMenu(buildTrayMenu(controller));
      },
    },
    {
      label: "Launch at login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

async function main(): Promise<void> {
  await app.whenReady();

  const { BridgeController } = await import("../controller");
  const { createUiServer } = await import("../ui/server");

  const controller = new BridgeController();
  createUiServer(controller, UI_PORT);

  await createWindow();

  tray = new Tray(nativeImage.createFromPath(path.join(ICON_DIR, "tray-icon.png")));
  tray.setToolTip("ScoreHub Bridge");
  tray.setContextMenu(buildTrayMenu(controller));
  tray.on("click", () => mainWindow?.show());

  if (process.env.CD_AUTOSTART === "true") {
    await controller.start();
  }

  app.on("activate", () => {
    if (mainWindow) mainWindow.show();
    else void createWindow();
  });
}

// Keep the app (and tray) alive with no open windows — quitting is only
// triggered from the tray's "Quit" item.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  isQuitting = true;
});

main().catch((err) => {
  console.error("Fatal:", err);
  app.quit();
});
