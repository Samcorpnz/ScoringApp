/**
 * ScoreHub Bridge — entry point.
 *
 * Starts the admin UI (http://localhost:4002) and optionally auto-starts
 * the configured data source if CD_AUTOSTART=true.
 *
 * All configuration is managed through the UI or via env vars / bridge-config.json.
 */

import { BridgeController } from "./controller";
import { createUiServer } from "./ui/server";
import { log } from "./logger";
import { initSentry, captureException } from "./sentry";

initSentry();

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  captureException(reason);
});

const UI_PORT    = parseInt(process.env.UI_PORT ?? "4002", 10);
const AUTOSTART  = process.env.CD_AUTOSTART === "true";

async function main(): Promise<void> {
  const controller = new BridgeController();
  createUiServer(controller, UI_PORT);

  log.info("=== ScoreHub Bridge ===");
  log.info(`Admin UI → http://localhost:${UI_PORT}`);
  log.info(`Source: ${controller.getConfig().source}`);
  log.info(`Relay:  ${controller.getConfig().relayUrl}`);

  if (AUTOSTART) {
    log.info("CD_AUTOSTART=true — starting source automatically");
    await controller.start();
  } else {
    log.info('Set CD_AUTOSTART=true to start automatically, or use the UI');
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  captureException(err);
  process.exit(1);
});
