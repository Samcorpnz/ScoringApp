import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { Server, Socket } from "socket.io";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { MatchState, DEFAULT_MATCH_STATE } from "./types";
import { getMatchStore, allActiveStores } from "./persistence";
import { verifyBridgeSecret, verifyControlSecret, LEGACY_ROOM_ID } from "./auth";

export interface ServerOptions {
  bridgeSecret?: string;
  controlSecret?: string;
  uploadDir?: string;
  allowedOrigins?: string | string[];
}

export function createServer(options: ServerOptions = {}) {
  const BRIDGE_SECRET  = options.bridgeSecret  ?? process.env.BRIDGE_SECRET  ?? "changeme";
  const CONTROL_SECRET = options.controlSecret ?? process.env.CONTROL_SECRET ?? "changeme";
  const UPLOAD_DIR     = options.uploadDir     ?? process.env.UPLOAD_DIR     ?? path.join(process.cwd(), "uploads");
  const ALLOWED_ORIGINS: string | string[] =
    options.allowedOrigins ??
    (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) : "*");

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json());
  app.use("/logos", express.static(UPLOAD_DIR));

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
  });

  // Per-org in-memory state and the active bridge connection for that org.
  // This is what makes match state genuinely tenant-scoped: one relay process
  // can serve many orgs, each isolated to its own Socket.io room.
  const matchStates = new Map<string, MatchState>();
  const bridgeSockets = new Map<string, Socket>();

  async function getState(orgId: string): Promise<MatchState> {
    const cached = matchStates.get(orgId);
    if (cached) return cached;
    const store = getMatchStore(orgId);
    const state = store ? await store.load() : { ...DEFAULT_MATCH_STATE };
    matchStates.set(orgId, state);
    return state;
  }

  function setState(orgId: string, next: MatchState): void {
    matchStates.set(orgId, next);
    io.to(orgId).emit("matchStateChange", next);
    getMatchStore(orgId)?.save(next);
  }

  async function applyManualUpdate(orgId: string, patch: Partial<MatchState>): Promise<MatchState> {
    const current = await getState(orgId);
    const next: MatchState = {
      ...current,
      ...patch,
      sequenceId: current.sequenceId + 1,
      inputSource: patch.inputSource ?? "manual",
      home:    { ...current.home,    ...(patch.home    ?? {}) },
      visitor: { ...current.visitor, ...(patch.visitor ?? {}) },
    };
    setState(orgId, next);
    return next;
  }

  // Tick the clock every second for every loaded org that's running and
  // not currently being driven by a connected bridge.
  const clockInterval = setInterval(() => {
    for (const [orgId, state] of matchStates) {
      if (!state.isRunning || bridgeSockets.get(orgId)?.connected) continue;
      const next = state.countDown ? state.clockSeconds - 1 : state.clockSeconds + 1;
      setState(orgId, { ...state, clockSeconds: next, sequenceId: state.sequenceId + 1 });
    }
  }, 1000);

  // ─── Logo upload ─────────────────────────────────────────────────────────────

  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, `${(_req as any).params.team}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  async function controlAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    const secret = req.headers["x-control-secret"];
    const result = await verifyControlSecret(typeof secret === "string" ? secret : undefined, CONTROL_SECRET);
    if (!result) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as any).orgId = result.orgId;
    next();
  }

  // 20 file-system operations per IP per minute — prevents filesystem exhaustion
  // from a compromised or leaked secret.
  const fsRateLimit = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too many requests" },
  });

  app.post(
    "/api/logo/:team",
    controlAuth,
    fsRateLimit,
    upload.single("logo"),
    async (req, res) => {
      const team = req.params.team as "home" | "visitor";
      if (team !== "home" && team !== "visitor") {
        res.status(400).json({ error: "team must be 'home' or 'visitor'" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "no file uploaded" });
        return;
      }

      const orgId = (req as any).orgId as string;
      const ext = path.extname(req.file.filename).toLowerCase();
      const logoUrl = `/logos/${team}${ext}?t=${Date.now()}`;
      const state = await getState(orgId);

      await applyManualUpdate(orgId, {
        [team]: { ...state[team], logoUrl },
      } as Partial<MatchState>);

      res.json({ logoUrl });
    }
  );

  app.delete("/api/logo/:team", controlAuth, fsRateLimit, async (req, res) => {
    const team = req.params.team as "home" | "visitor";
    if (team !== "home" && team !== "visitor") {
      res.status(400).json({ error: "team must be 'home' or 'visitor'" });
      return;
    }
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(`${team}.`));
    files.forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));

    const orgId = (req as any).orgId as string;
    const state = await getState(orgId);
    await applyManualUpdate(orgId, {
      [team]: { ...state[team], logoUrl: "" },
    } as Partial<MatchState>);

    res.json({ status: "removed" });
  });

  // ─── Competition logo upload ──────────────────────────────────────────────────

  const compStorage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, `competition${ext}`);
    },
  });

  const compUpload = multer({
    storage: compStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  app.post("/api/competition-logo", controlAuth, fsRateLimit, compUpload.single("logo"), async (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    const orgId = (req as any).orgId as string;
    const ext = path.extname(req.file.filename).toLowerCase();
    const competitionLogoUrl = `/logos/competition${ext}?t=${Date.now()}`;
    const state = await getState(orgId);
    await applyManualUpdate(orgId, { displayTheme: { ...state.displayTheme, competitionLogoUrl } });
    res.json({ competitionLogoUrl });
  });

  app.delete("/api/competition-logo", controlAuth, fsRateLimit, async (req, res) => {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith("competition."));
    files.forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
    const orgId = (req as any).orgId as string;
    const state = await getState(orgId);
    await applyManualUpdate(orgId, { displayTheme: { ...state.displayTheme, competitionLogoUrl: "" } });
    res.json({ status: "removed" });
  });

  // ─── Sound upload ────────────────────────────────────────────────────────────

  const SOUNDS_DIR = path.join(UPLOAD_DIR, "sounds");
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  app.use("/sounds", express.static(SOUNDS_DIR));

  const soundStorage = multer.diskStorage({
    destination: SOUNDS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp3";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${id}${ext}`);
    },
  });

  const soundUpload = multer({
    storage: soundStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype.startsWith("audio/"));
    },
  });

  app.post("/api/sound", controlAuth, fsRateLimit, soundUpload.single("sound"), (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    res.json({ filename: req.file.filename, originalName: req.file.originalname });
  });

  const ALLOWED_AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".webm"]);
  app.delete("/api/sound/:filename", controlAuth, fsRateLimit, (req, res) => {
    const filename = path.basename(String(req.params.filename));
    if (!ALLOWED_AUDIO_EXTS.has(path.extname(filename).toLowerCase())) {
      res.status(400).json({ error: "invalid file type" });
      return;
    }
    const filePath = path.join(SOUNDS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ status: "removed" });
  });

  // ─── REST ────────────────────────────────────────────────────────────────────

  app.get("/", (_req, res) => res.json({ status: "ok", version: "1.0.0" }));

  app.get("/state", async (req, res) => {
    const orgId = typeof req.query.org === "string" ? req.query.org : LEGACY_ROOM_ID;
    res.json(await getState(orgId));
  });

  app.post("/manual", async (req, res) => {
    const secret = req.headers["x-control-secret"];
    const result = await verifyControlSecret(typeof secret === "string" ? secret : undefined, CONTROL_SECRET);
    if (!result) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const next = await applyManualUpdate(result.orgId, req.body as Partial<MatchState>);
    res.json(next);
  });

  // ─── Socket.io ───────────────────────────────────────────────────────────────

  io.use(async (socket, next) => {
    const { secret, role, orgId: requestedOrgId } = socket.handshake.auth as {
      secret?: string;
      role?: string;
      orgId?: string;
    };

    let orgId: string | null = null;

    if (role === "bridge") {
      const result = await verifyBridgeSecret(secret, BRIDGE_SECRET);
      if (result) {
        orgId = result.orgId;
        (socket as any).isBridge = true;
      }
    } else if (role === "control") {
      const result = await verifyControlSecret(secret, CONTROL_SECRET);
      if (result) {
        orgId = result.orgId;
        (socket as any).isControl = true;
      }
    }

    (socket as any).orgId = orgId ?? requestedOrgId ?? LEGACY_ROOM_ID;
    next();
  });

  io.on("connection", async (socket) => {
    const orgId = (socket as any).orgId as string;
    const isBridge  = (socket as any).isBridge  === true;
    const isControl = (socket as any).isControl === true;
    const role = isBridge ? "bridge" : isControl ? "control" : "viewer";

    socket.join(orgId);
    console.log(`[+] ${role} connected to org ${orgId} (${socket.id})`);

    socket.emit("matchStateChange", await getState(orgId));

    if (isBridge) {
      const existingBridge = bridgeSockets.get(orgId);
      if (existingBridge) {
        console.warn(`[relay] Replacing existing bridge connection for org ${orgId}`);
        existingBridge.disconnect(true);
      }
      bridgeSockets.set(orgId, socket);

      socket.on("stateUpdate", async (state: MatchState) => {
        const current = await getState(orgId);
        if (state.sequenceId >= current.sequenceId) {
          setState(orgId, {
            ...state,
            home:         { ...state.home,    color: current.home.color,    logoUrl: current.home.logoUrl    },
            visitor:      { ...state.visitor, color: current.visitor.color, logoUrl: current.visitor.logoUrl },
            displayTheme: { ...current.displayTheme },
          });
        }
      });
    }

    if (isControl) {
      socket.on("manualUpdate", async (patch: Partial<MatchState>) => {
        await applyManualUpdate(orgId, patch);
        const bridge = bridgeSockets.get(orgId);
        if (bridge?.connected) bridge.emit("manualUpdate", patch);
      });

      socket.on("resetMatch", async () => {
        const current = await getState(orgId);
        const next: MatchState = {
          ...DEFAULT_MATCH_STATE,
          sequenceId: current.sequenceId + 1,
          home:    { ...DEFAULT_MATCH_STATE.home,    name: current.home.name,    color: current.home.color,    logoUrl: current.home.logoUrl    },
          visitor: { ...DEFAULT_MATCH_STATE.visitor, name: current.visitor.name, color: current.visitor.color, logoUrl: current.visitor.logoUrl },
          displayTheme: { ...current.displayTheme },
        };
        setState(orgId, next);
        const bridge = bridgeSockets.get(orgId);
        if (bridge?.connected) bridge.emit("manualUpdate", next);
      });
    }

    socket.on("disconnect", () => {
      if (isBridge && bridgeSockets.get(orgId) === socket) bridgeSockets.delete(orgId);
      console.log(`[-] ${role} disconnected from org ${orgId} (${socket.id})`);
    });
  });

  function close(cb?: (err?: Error) => void) {
    clearInterval(clockInterval);
    const flushes = allActiveStores().map(store =>
      store.flush().catch(err => console.error(`[relay] failed to flush match state for org ${store.orgId} on close`, err))
    );
    Promise.allSettled(flushes).finally(() => io.close(cb));
  }

  return { app, io, httpServer, close };
}
