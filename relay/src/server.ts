import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { Server, Socket } from "socket.io";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { MatchState, DEFAULT_MATCH_STATE, DEFAULT_DISPLAY_THEME } from "./types";

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

  let currentState: MatchState = { ...DEFAULT_MATCH_STATE };
  let bridgeSocket: Socket | null = null;

  // Tick the clock every second when running and no bridge is driving it
  const clockInterval = setInterval(() => {
    if (!currentState.isRunning || bridgeSocket?.connected) return;
    const next = currentState.countDown
      ? currentState.clockSeconds - 1
      : currentState.clockSeconds + 1;
    currentState = { ...currentState, clockSeconds: next, sequenceId: currentState.sequenceId + 1 };
    io.emit("matchStateChange", currentState);
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

  function logoUploadAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void {
    const secret = req.headers["x-control-secret"];
    if (secret !== CONTROL_SECRET) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
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
    logoUploadAuth,
    fsRateLimit,
    upload.single("logo"),
    (req, res) => {
      const team = req.params.team as "home" | "visitor";
      if (team !== "home" && team !== "visitor") {
        res.status(400).json({ error: "team must be 'home' or 'visitor'" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "no file uploaded" });
        return;
      }

      const ext = path.extname(req.file.filename).toLowerCase();
      const logoUrl = `/logos/${team}${ext}?t=${Date.now()}`;

      applyManualUpdate({
        [team]: { ...currentState[team], logoUrl },
      } as Partial<MatchState>);

      res.json({ logoUrl });
    }
  );

  app.delete("/api/logo/:team", logoUploadAuth, fsRateLimit, (req, res) => {
    const team = req.params.team as "home" | "visitor";
    if (team !== "home" && team !== "visitor") {
      res.status(400).json({ error: "team must be 'home' or 'visitor'" });
      return;
    }
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(`${team}.`));
    files.forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));

    applyManualUpdate({
      [team]: { ...currentState[team], logoUrl: "" },
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

  app.post("/api/competition-logo", logoUploadAuth, fsRateLimit, compUpload.single("logo"), (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    const ext = path.extname(req.file.filename).toLowerCase();
    const competitionLogoUrl = `/logos/competition${ext}?t=${Date.now()}`;
    applyManualUpdate({ displayTheme: { ...currentState.displayTheme, competitionLogoUrl } });
    res.json({ competitionLogoUrl });
  });

  app.delete("/api/competition-logo", logoUploadAuth, fsRateLimit, (req, res) => {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith("competition."));
    files.forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
    applyManualUpdate({ displayTheme: { ...currentState.displayTheme, competitionLogoUrl: "" } });
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

  app.post("/api/sound", logoUploadAuth, fsRateLimit, soundUpload.single("sound"), (req, res) => {
    if (!req.file) { res.status(400).json({ error: "no file uploaded" }); return; }
    res.json({ filename: req.file.filename, originalName: req.file.originalname });
  });

  const ALLOWED_AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".webm"]);
  app.delete("/api/sound/:filename", logoUploadAuth, fsRateLimit, (req, res) => {
    const filename = path.basename(req.params.filename as string);
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
  app.get("/state", (_req, res) => res.json(currentState));

  app.post("/manual", (req, res) => {
    if (req.headers["x-control-secret"] !== CONTROL_SECRET) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    applyManualUpdate(req.body as Partial<MatchState>);
    res.json(currentState);
  });

  // ─── Socket.io ───────────────────────────────────────────────────────────────

  io.use((socket, next) => {
    const { secret, role } = socket.handshake.auth as { secret?: string; role?: string };
    if (role === "bridge"  && secret === BRIDGE_SECRET)  (socket as any).isBridge  = true;
    if (role === "control" && secret === CONTROL_SECRET) (socket as any).isControl = true;
    next();
  });

  io.on("connection", (socket) => {
    const isBridge  = (socket as any).isBridge  === true;
    const isControl = (socket as any).isControl === true;
    const role = isBridge ? "bridge" : isControl ? "control" : "viewer";

    console.log(`[+] ${role} connected (${socket.id})`);

    socket.emit("matchStateChange", currentState);

    if (isBridge) {
      if (bridgeSocket) {
        console.warn("[relay] Replacing existing bridge connection");
        bridgeSocket.disconnect(true);
      }
      bridgeSocket = socket;

      socket.on("stateUpdate", (state: MatchState) => {
        if (state.sequenceId >= currentState.sequenceId) {
          currentState = {
            ...state,
            home:         { ...state.home,    color: currentState.home.color,    logoUrl: currentState.home.logoUrl    },
            visitor:      { ...state.visitor, color: currentState.visitor.color, logoUrl: currentState.visitor.logoUrl },
            displayTheme: { ...currentState.displayTheme },
          };
          io.emit("matchStateChange", currentState);
        }
      });
    }

    if (isControl) {
      socket.on("manualUpdate", (patch: Partial<MatchState>) => {
        applyManualUpdate(patch);
        if (bridgeSocket?.connected) bridgeSocket.emit("manualUpdate", patch);
      });

      socket.on("resetMatch", () => {
        currentState = {
          ...DEFAULT_MATCH_STATE,
          sequenceId: currentState.sequenceId + 1,
          home:    { ...DEFAULT_MATCH_STATE.home,    name: currentState.home.name,    color: currentState.home.color,    logoUrl: currentState.home.logoUrl    },
          visitor: { ...DEFAULT_MATCH_STATE.visitor, name: currentState.visitor.name, color: currentState.visitor.color, logoUrl: currentState.visitor.logoUrl },
          displayTheme: { ...currentState.displayTheme },
        };
        io.emit("matchStateChange", currentState);
        if (bridgeSocket?.connected) bridgeSocket.emit("manualUpdate", currentState);
      });
    }

    socket.on("disconnect", () => {
      if (isBridge && bridgeSocket?.id === socket.id) bridgeSocket = null;
      console.log(`[-] ${role} disconnected (${socket.id})`);
    });
  });

  function applyManualUpdate(patch: Partial<MatchState>): void {
    currentState = {
      ...currentState,
      ...patch,
      sequenceId: currentState.sequenceId + 1,
      inputSource: patch.inputSource ?? "manual",
      home:    { ...currentState.home,    ...(patch.home    ?? {}) },
      visitor: { ...currentState.visitor, ...(patch.visitor ?? {}) },
    };
    io.emit("matchStateChange", currentState);
  }

  function close(cb?: (err?: Error) => void) {
    clearInterval(clockInterval);
    io.close(cb);
  }

  return { app, io, httpServer, close };
}
