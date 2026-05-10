import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { Server, Socket } from "socket.io";
import multer from "multer";
import { MatchState, DEFAULT_MATCH_STATE } from "./types";

export interface ServerOptions {
  bridgeSecret?: string;
  controlSecret?: string;
  uploadDir?: string;
}

export function createServer(options: ServerOptions = {}) {
  const BRIDGE_SECRET  = options.bridgeSecret  ?? process.env.BRIDGE_SECRET  ?? "changeme";
  const CONTROL_SECRET = options.controlSecret ?? process.env.CONTROL_SECRET ?? "changeme";
  const UPLOAD_DIR     = options.uploadDir     ?? process.env.UPLOAD_DIR     ?? path.join(process.cwd(), "uploads");

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/logos", express.static(UPLOAD_DIR));

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
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

  app.post(
    "/api/logo/:team",
    logoUploadAuth,
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

  app.delete("/api/logo/:team", logoUploadAuth, (req, res) => {
    const team = req.params.team as "home" | "visitor";
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(`${team}.`));
    files.forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));

    applyManualUpdate({
      [team]: { ...currentState[team], logoUrl: "" },
    } as Partial<MatchState>);

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
            home:    { ...state.home,    color: currentState.home.color,    logoUrl: currentState.home.logoUrl    },
            visitor: { ...state.visitor, color: currentState.visitor.color, logoUrl: currentState.visitor.logoUrl },
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
