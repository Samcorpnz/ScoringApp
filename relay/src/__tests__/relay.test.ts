import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";
import { DEFAULT_MATCH_STATE, MatchState } from "../types";

const BRIDGE_SECRET  = "test-bridge-secret";
const CONTROL_SECRET = "test-control-secret";

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-test-"));
  ({ app, httpServer } = createServer({ bridgeSecret: BRIDGE_SECRET, controlSecret: CONTROL_SECRET, uploadDir }));
  httpServer.listen(0, () => {
    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  httpServer.close(done);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Connect a socket and wait for the initial matchStateChange that the server
// emits on connection. Both events may arrive in the same I/O tick so the
// listener must be registered before the connect handshake completes.
function connectAndWait(role?: "bridge" | "control"): Promise<{ socket: Socket; initialState: MatchState }> {
  const auth = role
    ? { secret: role === "bridge" ? BRIDGE_SECRET : CONTROL_SECRET, role }
    : undefined;
  const socket = ioClient(serverUrl, { auth, reconnection: false });
  return new Promise((resolve, reject) => {
    let connected = false;
    let initialState: MatchState | undefined;
    const tryResolve = () => {
      if (connected && initialState !== undefined) resolve({ socket, initialState: initialState! });
    };
    // Register matchStateChange BEFORE connect so we never miss it
    socket.once("matchStateChange", (s: MatchState) => { initialState = s; tryResolve(); });
    socket.on("connect", () => { connected = true; tryResolve(); });
    socket.on("connect_error", reject);
  });
}

function nextEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>(resolve => socket.once(event, resolve));
}

// ─── REST API ─────────────────────────────────────────────────────────────────

describe("GET /", () => {
  it("returns health check", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", version: "1.0.0" });
  });
});

describe("GET /state", () => {
  it("returns the current match state", async () => {
    const res = await request(app).get("/state");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sequenceId");
    expect(res.body).toHaveProperty("home");
    expect(res.body).toHaveProperty("visitor");
    expect(res.body.home).toHaveProperty("score");
  });
});

describe("POST /manual", () => {
  it("rejects requests without a secret header", async () => {
    const res = await request(app).post("/manual").send({ home: { score: 99 } });
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong secret", async () => {
    const res = await request(app)
      .post("/manual")
      .set("x-control-secret", "wrong-secret")
      .send({ home: { score: 99 } });
    expect(res.status).toBe(401);
  });

  it("applies a patch and returns updated state", async () => {
    const res = await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ matchName: "Test Match" });
    expect(res.status).toBe(200);
    expect(res.body.matchName).toBe("Test Match");
  });

  it("deep-merges team fields without wiping unrelated properties", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ home: { name: "Eagles" } });

    const { body } = await request(app).get("/state");
    expect(body.home.name).toBe("Eagles");
    expect(body.home).toHaveProperty("score");
    expect(body.home).toHaveProperty("color");
  });
});

describe("POST /api/logo/:team auth", () => {
  it("rejects logo upload without secret", async () => {
    const res = await request(app)
      .post("/api/logo/home")
      .attach("logo", Buffer.from(""), "test.png");
    expect(res.status).toBe(401);
  });

  it("rejects logo delete without secret", async () => {
    const res = await request(app).delete("/api/logo/home");
    expect(res.status).toBe(401);
  });
});

// ─── Socket.io events ─────────────────────────────────────────────────────────

describe("socket — viewer", () => {
  it("receives matchStateChange immediately on connect", async () => {
    const { socket, initialState } = await connectAndWait();
    try {
      expect(initialState).toHaveProperty("sequenceId");
      expect(initialState).toHaveProperty("home");
      expect(initialState).toHaveProperty("visitor");
    } finally {
      socket.disconnect();
    }
  });
});

describe("socket — bridge stateUpdate", () => {
  it("broadcasts stateUpdate from bridge to all viewers", async () => {
    const { socket: bridge } = await connectAndWait("bridge");
    const { socket: viewer } = await connectAndWait();
    try {
      const { body: current } = await request(app).get("/state");

      // Register listener BEFORE emitting to avoid a race
      const broadcastPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      bridge.emit("stateUpdate", {
        ...DEFAULT_MATCH_STATE,
        sequenceId: current.sequenceId + 100,
        home:    { ...DEFAULT_MATCH_STATE.home,    score: 42 },
        visitor: { ...DEFAULT_MATCH_STATE.visitor, score: 17 },
      });

      const received = await broadcastPromise;
      expect(received.home.score).toBe(42);
      expect(received.visitor.score).toBe(17);
    } finally {
      bridge.disconnect();
      viewer.disconnect();
    }
  });

  it("preserves control-set logo when bridge sends stateUpdate", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ home: { logoUrl: "/logos/home.png" } });

    const { socket: bridge } = await connectAndWait("bridge");
    const { socket: viewer } = await connectAndWait();
    try {
      const { body: current } = await request(app).get("/state");

      const broadcastPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      bridge.emit("stateUpdate", {
        ...DEFAULT_MATCH_STATE,
        sequenceId: current.sequenceId + 100,
        home: { ...DEFAULT_MATCH_STATE.home, logoUrl: "" }, // bridge sends empty logoUrl
      });

      const received = await broadcastPromise;
      // relay preserves the control-set logo, ignoring the bridge's blank value
      expect(received.home.logoUrl).toBe("/logos/home.png");
    } finally {
      bridge.disconnect();
      viewer.disconnect();
    }
  });
});

describe("socket — control manualUpdate", () => {
  it("applies patch and broadcasts to all viewers", async () => {
    const { socket: control } = await connectAndWait("control");
    const { socket: viewer  } = await connectAndWait();
    try {
      const broadcastPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("manualUpdate", { period: "4" });

      const received = await broadcastPromise;
      expect(received.period).toBe("4");
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });
});

describe("socket — control resetMatch", () => {
  it("resets scores to 0 but preserves team names and colors", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({
        home:    { name: "Hawks", color: "#ff0000", score: 55 },
        visitor: { name: "Owls",  color: "#0000ff", score: 44 },
      });

    const { socket: control } = await connectAndWait("control");
    const { socket: viewer  } = await connectAndWait();
    try {
      const broadcastPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("resetMatch");

      const received = await broadcastPromise;
      expect(received.home.score).toBe(0);
      expect(received.visitor.score).toBe(0);
      expect(received.home.name).toBe("Hawks");
      expect(received.visitor.name).toBe("Owls");
      expect(received.home.color).toBe("#ff0000");
      expect(received.visitor.color).toBe("#0000ff");
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });
});
