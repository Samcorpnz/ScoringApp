import express from "express";
import { createServer } from "http";
import path from "path";
import { BridgeController, BridgeConfig } from "../controller";
import { addSseClient, removeSseClient } from "../logger";

export function createUiServer(controller: BridgeController, port: number = 4002): ReturnType<typeof createServer> {
  const app = express();
  app.use(express.json());

  // Serve the HTML UI — works for both ts-node-dev (src/ui) and compiled (dist/ui)
  app.use(express.static(path.join(__dirname, "public")));

  // ── Status ──────────────────────────────────────────────────────────────────

  app.get("/api/status", (_req, res) => {
    res.json({
      status: controller.status,
      lastError: controller.lastError,
      relay: controller.getRelayHealth(),
      state: {
        home: controller.getState().home.score,
        visitor: controller.getState().visitor.score,
        matchName: controller.getState().matchName,
        isRunning: controller.getState().isRunning,
        period: controller.getState().period,
        inputSource: controller.getState().inputSource,
        netballStats: !!controller.getState().netballStats,
      },
    });
  });

  // ── Config ──────────────────────────────────────────────────────────────────

  app.get("/api/config", (_req, res) => {
    res.json(controller.getConfig());
  });

  app.post("/api/config", (req, res) => {
    const patch = req.body as Partial<BridgeConfig>;
    // Coerce number fields that come in as strings from the form
    if (patch.baudRate) patch.baudRate = Number(patch.baudRate);
    if (patch.cdPollMs) patch.cdPollMs = Number(patch.cdPollMs);
    if (patch.cdScrapePollMs) patch.cdScrapePollMs = Number(patch.cdScrapePollMs);
    controller.updateConfig(patch);
    res.json({ ok: true, config: controller.getConfig() });
  });

  // ── Control ─────────────────────────────────────────────────────────────────

  app.post("/api/start", async (_req, res) => {
    await controller.start();
    res.json({ status: controller.status, lastError: controller.lastError });
  });

  app.post("/api/stop", async (_req, res) => {
    await controller.stop();
    res.json({ status: controller.status });
  });

  app.post("/api/restart", async (_req, res) => {
    await controller.restart();
    res.json({ status: controller.status, lastError: controller.lastError });
  });

  // ── Serial ports ─────────────────────────────────────────────────────────────

  app.get("/api/ports", async (_req, res) => {
    try {
      const ports = await controller.listSerialPorts();
      res.json({ ports });
    } catch (err) {
      res.json({ ports: [], error: (err as Error).message });
    }
  });

  // ── SSE log stream ───────────────────────────────────────────────────────────

  app.get("/api/logs", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    addSseClient(res);

    req.on("close", () => removeSseClient(res));
  });

  const server = createServer(app);
  server.listen(port, () => {
    console.log(`[ui] Bridge admin UI → http://localhost:${port}`);
  });

  return server;
}
