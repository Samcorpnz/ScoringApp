import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { Server, Socket } from "socket.io";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { createAdapter } from "@socket.io/redis-adapter";
import { MatchState, DEFAULT_MATCH_STATE } from "./types";
import { getMatchStore, allActiveStores } from "./persistence";
import { verifyBridgeSecret, verifyControlSecret, LEGACY_ROOM_ID } from "./auth";
import { getRedisClients, acquireTickLock, closeRedis } from "./redis";
import { requirePlan, ConcurrentMatchLimitError } from "./entitlements";
import { r2Enabled, putObject, deleteByPrefix } from "./storage";
import { matchStatePatchSchema, matchStateSchema } from "./schemas";

export interface ServerOptions {
  bridgeSecret?: string;
  controlSecret?: string;
  uploadDir?: string;
  allowedOrigins?: string | string[];
  controlRateLimit?: number;
}

function requireSecret(name: "BRIDGE_SECRET" | "CONTROL_SECRET", value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} must be set — refusing to start with a default/missing secret. See relay/.env.example.`
    );
  }
  return value;
}

// No wildcard fallback — an unset/empty value denies all cross-origin
// requests rather than defaulting to "*", which would let any site read
// control-panel/control-secret-gated responses (SA code-scanning #14).
function requireAllowedOrigins(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  if (list.length === 0 || list.includes("*")) {
    throw new Error(
      "ALLOWED_ORIGINS must be set to one or more explicit origins (comma-separated) — refusing to start with a wildcard/missing CORS origin. See relay/.env.example."
    );
  }
  return list;
}

export function createServer(options: ServerOptions = {}) {
  const BRIDGE_SECRET  = requireSecret("BRIDGE_SECRET", options.bridgeSecret || process.env.BRIDGE_SECRET);
  const CONTROL_SECRET = requireSecret("CONTROL_SECRET", options.controlSecret || process.env.CONTROL_SECRET);
  const UPLOAD_DIR     = options.uploadDir     ?? process.env.UPLOAD_DIR     ?? path.join(process.cwd(), "uploads");
  const ALLOWED_ORIGINS: string[] = requireAllowedOrigins(
    options.allowedOrigins ?? process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim())
  );

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = express();
  // Railway (and most PaaS hosts) sit in front as a reverse proxy and set
  // X-Forwarded-For — without this, express-rate-limit can't trust that
  // header and falls back to misidentifying every request as coming from
  // the same IP, defeating the per-IP brute-force limits on controlAuth
  // routes. `1` trusts exactly one hop (the platform's own proxy).
  app.set("trust proxy", 1);
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json());
  app.use("/logos", express.static(UPLOAD_DIR));

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
  });

  // When REDIS_URL is set, broadcasts reach sockets connected to other relay
  // instances too — required so multiple relay processes can sit behind a
  // load balancer (SA-19). Absent REDIS_URL this is a no-op single instance.
  const redisClients = getRedisClients();
  if (redisClients) {
    io.adapter(createAdapter(redisClients.pub, redisClients.sub));
  }

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
  // not currently being driven by a connected bridge. acquireTickLock
  // ensures only one relay instance advances a given org's clock when
  // multiple instances share Redis (SA-19) — it's a no-op true when Redis
  // is unset, so single-instance behavior is unchanged.
  const clockInterval = setInterval(() => {
    for (const [orgId, state] of matchStates) {
      if (!state.isRunning || bridgeSockets.get(orgId)?.connected) continue;
      acquireTickLock(orgId)
        .then(acquired => {
          if (!acquired) return;
          const next = state.countDown ? state.clockSeconds - 1 : state.clockSeconds + 1;
          setState(orgId, { ...state, clockSeconds: next, sequenceId: state.sequenceId + 1 });
        })
        .catch(err => console.error(`[relay] failed to acquire tick lock for org ${orgId}`, err));
    }
  }, 1000);

  // ─── Logo upload ─────────────────────────────────────────────────────────────
  // Local-disk paths and R2 object keys are both scoped under the requesting
  // org's id (set by controlAuth, which runs before multer in the middleware
  // chain) — logos/sounds are per-tenant, so a flat shared directory/bucket
  // prefix would leak one org's branding into every other org's display.

  const upload = multer({
    storage: r2Enabled
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (req, _file, cb) => {
            const dir = path.join(UPLOAD_DIR, (req as any).orgId);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".png";
            cb(null, `${(req as any).params.team}${ext}`);
          },
        }),
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

  // 20 requests per IP per minute on control-secret-gated endpoints — must run
  // before controlAuth, or failed auth attempts (brute force) bypass the limit
  // entirely since the limiter would only see requests that already passed auth.
  const controlRateLimit = rateLimit({
    windowMs: 60_000,
    limit: options.controlRateLimit ?? 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too many requests" },
  });

  app.post(
    "/api/logo/:team",
    controlRateLimit,
    controlAuth,
    requirePlan(["pro", "venue"]),
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
      let logoUrl: string;
      if (r2Enabled) {
        const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
        const cdnUrl = await putObject(`logos/${orgId}/${team}${ext}`, req.file.buffer, req.file.mimetype);
        logoUrl = `${cdnUrl}?t=${Date.now()}`;
      } else {
        const ext = path.extname(req.file.filename).toLowerCase();
        logoUrl = `/logos/${orgId}/${team}${ext}?t=${Date.now()}`;
      }
      const state = await getState(orgId);

      await applyManualUpdate(orgId, {
        [team]: { ...state[team], logoUrl },
      } as Partial<MatchState>);

      res.json({ logoUrl });
    }
  );

  app.delete("/api/logo/:team", controlRateLimit, controlAuth, requirePlan(["pro", "venue"]), async (req, res) => {
    const team = req.params.team as "home" | "visitor";
    if (team !== "home" && team !== "visitor") {
      res.status(400).json({ error: "team must be 'home' or 'visitor'" });
      return;
    }
    const orgId = (req as any).orgId as string;
    if (r2Enabled) {
      await deleteByPrefix(`logos/${orgId}/${team}.`);
    } else {
      const dir = path.join(UPLOAD_DIR, orgId);
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).filter(f => f.startsWith(`${team}.`)).forEach(f => fs.unlinkSync(path.join(dir, f)));
      }
    }

    const state = await getState(orgId);
    await applyManualUpdate(orgId, {
      [team]: { ...state[team], logoUrl: "" },
    } as Partial<MatchState>);

    res.json({ status: "removed" });
  });

  // ─── Competition logo upload ──────────────────────────────────────────────────

  const compUpload = multer({
    storage: r2Enabled
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (req, _file, cb) => {
            const dir = path.join(UPLOAD_DIR, (req as any).orgId);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".png";
            cb(null, `competition${ext}`);
          },
        }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  app.post("/api/competition-logo", controlRateLimit, controlAuth, requirePlan(["pro", "venue"]), compUpload.single("logo"), async (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    const orgId = (req as any).orgId as string;
    let competitionLogoUrl: string;
    if (r2Enabled) {
      const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
      const cdnUrl = await putObject(`logos/${orgId}/competition${ext}`, req.file.buffer, req.file.mimetype);
      competitionLogoUrl = `${cdnUrl}?t=${Date.now()}`;
    } else {
      const ext = path.extname(req.file.filename).toLowerCase();
      competitionLogoUrl = `/logos/${orgId}/competition${ext}?t=${Date.now()}`;
    }
    const state = await getState(orgId);
    await applyManualUpdate(orgId, { displayTheme: { ...state.displayTheme, competitionLogoUrl } });
    res.json({ competitionLogoUrl });
  });

  app.delete("/api/competition-logo", controlRateLimit, controlAuth, requirePlan(["pro", "venue"]), async (req, res) => {
    const orgId = (req as any).orgId as string;
    if (r2Enabled) {
      await deleteByPrefix(`logos/${orgId}/competition.`);
    } else {
      const dir = path.join(UPLOAD_DIR, orgId);
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).filter(f => f.startsWith("competition.")).forEach(f => fs.unlinkSync(path.join(dir, f)));
      }
    }
    const state = await getState(orgId);
    await applyManualUpdate(orgId, { displayTheme: { ...state.displayTheme, competitionLogoUrl: "" } });
    res.json({ status: "removed" });
  });

  // ─── Sound upload ────────────────────────────────────────────────────────────

  const SOUNDS_DIR = path.join(UPLOAD_DIR, "sounds");
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  app.use("/sounds", express.static(SOUNDS_DIR));

  const soundUpload = multer({
    storage: r2Enabled
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (req, _file, cb) => {
            const dir = path.join(SOUNDS_DIR, (req as any).orgId);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || ".mp3";
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            cb(null, `${id}${ext}`);
          },
        }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype.startsWith("audio/"));
    },
  });

  app.post("/api/sound", controlRateLimit, controlAuth, requirePlan(["pro", "venue"]), soundUpload.single("sound"), async (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    const orgId = (req as any).orgId as string;

    if (r2Enabled) {
      const ext = path.extname(req.file.originalname).toLowerCase() || ".mp3";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const url = await putObject(`sounds/${orgId}/${filename}`, req.file.buffer, req.file.mimetype);
      res.json({ filename, originalName: req.file.originalname, url });
      return;
    }

    res.json({ filename: req.file.filename, originalName: req.file.originalname, url: `/sounds/${orgId}/${req.file.filename}` });
  });

  const ALLOWED_AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".webm"]);
  app.delete("/api/sound/:filename", controlRateLimit, controlAuth, requirePlan(["pro", "venue"]), async (req, res) => {
    const filename = path.basename(String(req.params.filename));
    if (!ALLOWED_AUDIO_EXTS.has(path.extname(filename).toLowerCase())) {
      res.status(400).json({ error: "invalid file type" });
      return;
    }
    const orgId = (req as any).orgId as string;
    if (r2Enabled) {
      await deleteByPrefix(`sounds/${orgId}/${filename}`);
    } else {
      const filePath = path.join(SOUNDS_DIR, orgId, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ status: "removed" });
  });

  // ─── REST ────────────────────────────────────────────────────────────────────

  app.get("/", (_req, res) => res.json({ status: "ok", version: "1.0.0" }));

  // Shared by every route that can trigger match creation (getState/
  // applyManualUpdate), since that's the one place a Free-tier account can
  // be blocked from bringing up a second concurrent live match.
  function respondToStateError(res: express.Response, err: unknown): void {
    if (err instanceof ConcurrentMatchLimitError) {
      res.status(402).json({ error: err.message });
      return;
    }
    console.error("[relay] failed to load/update match state:", err);
    res.status(500).json({ error: "internal error" });
  }

  app.get("/state", async (req, res) => {
    const orgId = typeof req.query.org === "string" ? req.query.org : LEGACY_ROOM_ID;
    try {
      res.json(await getState(orgId));
    } catch (err) {
      respondToStateError(res, err);
    }
  });

  app.post("/manual", controlRateLimit, async (req, res) => {
    const secret = req.headers["x-control-secret"];
    const result = await verifyControlSecret(typeof secret === "string" ? secret : undefined, CONTROL_SECRET);
    if (!result) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = matchStatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid match state patch", details: parsed.error.issues });
      return;
    }
    try {
      const next = await applyManualUpdate(result.orgId, parsed.data as Partial<MatchState>);
      res.json(next);
    } catch (err) {
      respondToStateError(res, err);
    }
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

  io.on("connection", (socket) => {
    const orgId = (socket as any).orgId as string;
    const isBridge  = (socket as any).isBridge  === true;
    const isControl = (socket as any).isControl === true;
    const role = isBridge ? "bridge" : isControl ? "control" : "viewer";

    socket.join(orgId);
    console.log(`[+] ${role} connected to org ${orgId} (${socket.id})`);

    // Register listeners synchronously, before the async state load below —
    // otherwise a client emitting an update immediately on connect can race
    // ahead of `await getState(orgId)` and have its event silently dropped.
    if (isBridge) {
      const existingBridge = bridgeSockets.get(orgId);
      if (existingBridge) {
        console.warn(`[relay] Replacing existing bridge connection for org ${orgId}`);
        existingBridge.disconnect(true);
      }
      bridgeSockets.set(orgId, socket);

      socket.on("stateUpdate", async (rawState: unknown) => {
        const parsed = matchStateSchema.safeParse(rawState);
        if (!parsed.success) {
          console.warn(`[relay] rejected malformed stateUpdate from org ${orgId}:`, parsed.error.issues);
          return;
        }
        const state = parsed.data as MatchState;
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
      socket.on("manualUpdate", async (rawPatch: unknown) => {
        const parsed = matchStatePatchSchema.safeParse(rawPatch);
        if (!parsed.success) {
          console.warn(`[relay] rejected malformed manualUpdate from org ${orgId}:`, parsed.error.issues);
          return;
        }
        const patch = parsed.data as Partial<MatchState>;
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

    getState(orgId)
      .then(state => socket.emit("matchStateChange", state))
      .catch(err => {
        if (err instanceof ConcurrentMatchLimitError) {
          socket.emit("error", { message: err.message });
          return;
        }
        console.error("[relay] failed to load initial state for org:", orgId, err);
      });
  });

  function close(cb?: (err?: Error) => void) {
    clearInterval(clockInterval);
    const flushes = allActiveStores().map(store =>
      store.flush().catch(err => console.error(`[relay] failed to flush match state for org ${store.orgId} on close`, err))
    );
    Promise.allSettled(flushes).finally(() =>
      closeRedis()
        .catch(err => console.error("[relay] failed to close redis clients on close", err))
        .finally(() => io.close(cb))
    );
  }

  // Catches errors thrown before a route handler runs — chiefly multer
  // (file-too-large, fileFilter rejection) — which otherwise bubble up as a
  // bare unlogged 500 with no context on what failed or why (SA-10).
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[relay] unhandled error:", req.method, req.path, err);
    if (res.headersSent) return;
    const message = err instanceof multer.MulterError ? err.message : "internal server error";
    res.status(err instanceof multer.MulterError ? 400 : 500).json({ error: message });
  });

  return { app, io, httpServer, close };
}
