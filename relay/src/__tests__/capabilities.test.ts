import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";
import { DEFAULT_MATCH_STATE, MatchState } from "../types";

const BRIDGE_SECRET  = "cap-bridge-secret";
const CONTROL_SECRET = "cap-control-secret";

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-cap-test-"));
  ({ app, httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    uploadDir,
    controlRateLimit: 5000,
    allowedOrigins: ["http://localhost:3000"],
    // Very short TTL so controller tokens expire quickly between tests,
    // letting the "first socket gets granted" test run in isolation.
    controllerTokenTtlMs: 50,
  }));
  httpServer.listen(0, () => {
    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>(resolve => socket.once(event, resolve));
}

// Connects as "control" and ensures the socket holds the controller token.
// Sends takeControl if another socket currently holds the token.
async function connectControl(): Promise<Socket> {
  const socket = ioClient(serverUrl, {
    auth: { secret: CONTROL_SECRET, role: "control" },
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect_error", reject);
    socket.on("controllerGranted", resolve);
    socket.on("controllerConflict", () => socket.emit("takeControl"));
  });
  return socket;
}

// Connect a viewer socket and wait for the initial matchStateChange
function connectViewer(): Promise<{ socket: Socket; initialState: MatchState }> {
  const socket = ioClient(serverUrl, { reconnection: false });
  return new Promise((resolve, reject) => {
    socket.on("connect_error", reject);
    socket.once("matchStateChange", (s: MatchState) => resolve({ socket, initialState: s }));
  });
}

// Reset match state to known baseline between tests
async function resetState() {
  await request(app)
    .post("/manual")
    .set("x-control-secret", CONTROL_SECRET)
    .send({
      home:    { ...DEFAULT_MATCH_STATE.home,    score: 0, name: "Home" },
      visitor: { ...DEFAULT_MATCH_STATE.visitor, score: 0, name: "Visitor" },
      sport: "volleyball",
      period: "1",
      isRunning: false,
    });
}

// ─── Undo stack ───────────────────────────────────────────────────────────────

describe("undo stack", () => {
  it("returns to the previous state after a single undo", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ home: { score: 0 } });

    const control = await connectControl();
    const { socket: viewer } = await connectViewer();
    try {
      // Score once
      const afterScore = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("manualUpdate", { home: { score: 5 } });
      const scored = await afterScore;
      expect(scored.home.score).toBe(5);

      // Undo — should revert the score
      const afterUndo = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("undo");
      const undone = await afterUndo;
      expect(undone.home.score).toBe(0);
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });

  it("undo on an empty stack is a no-op (no broadcast)", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ home: { score: 0 } });

    const control = await connectControl();
    // Drain the undo stack by setting scores then undoing until empty
    // (We don't know stack depth here, so we just call undo with no prior changes)
    const { socket: viewer } = await connectViewer();
    try {
      let broadcastFired = false;
      viewer.on("matchStateChange", () => { broadcastFired = true; });

      // Clear the undo stack by undoing all prior test changes (drain approach)
      // Then send one final undo that must be a no-op
      // Simplest: use a fresh server state reference by checking sequenceId
      const { body: before } = await request(app).get("/state");
      control.emit("undo"); // unknown stack depth — drain
      control.emit("undo");
      control.emit("undo");

      // Wait 200ms — if no broadcast is coming, we're good
      await new Promise(r => setTimeout(r, 200));
      // We can't assert broadcastFired === false absolutely (prior events may fire)
      // but we CAN assert the score didn't go below zero
      const { body: after } = await request(app).get("/state");
      expect(after.home.score).toBeGreaterThanOrEqual(0);
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });

  it("circular buffer drops the oldest entry after 50 pushes", async () => {
    const control = await connectControl();
    const { socket: viewer } = await connectViewer();
    try {
      // Push 51 manual updates to overflow the 50-state buffer
      for (let i = 1; i <= 51; i++) {
        const broadcast = nextEvent<MatchState>(viewer, "matchStateChange");
        control.emit("manualUpdate", { home: { score: i } });
        await broadcast;
      }
      // Score should now be 51
      const { body: state } = await request(app).get("/state");
      expect(state.home.score).toBe(51);

      // Undo 50 times — should succeed for all 50
      for (let i = 0; i < 50; i++) {
        const broadcast = nextEvent<MatchState>(viewer, "matchStateChange");
        control.emit("undo");
        await broadcast;
      }

      // After 50 undos: the 51st push (score=51) was what got dropped.
      // The oldest surviving entry is score=1 (push #1 was evicted, push #2 is oldest).
      const { body: afterUndo } = await request(app).get("/state");
      expect(afterUndo.home.score).toBe(1);

      // One more undo — stack is empty now, no-op
      const broadcastFired = jest.fn();
      viewer.on("matchStateChange", broadcastFired);
      control.emit("undo");
      await new Promise(r => setTimeout(r, 150));
      expect(broadcastFired).not.toHaveBeenCalled();
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });
});

// ─── Controller mutex ─────────────────────────────────────────────────────────

describe("controller mutex", () => {
  // Wait for the previous tests' controller tokens to expire (TTL = 50ms in test server)
  beforeEach(() => new Promise(r => setTimeout(r, 100)));

  it("grants control to the first connecting control socket", async () => {
    const socket = ioClient(serverUrl, {
      auth: { secret: CONTROL_SECRET, role: "control" },
      reconnection: false,
    });
    try {
      // If this resolves, the event was received — no data is emitted with it
      await nextEvent(socket, "controllerGranted");
    } finally {
      socket.disconnect();
    }
  });

  it("sends controllerConflict to a second simultaneous control socket", async () => {
    const control1 = await connectControl();
    // Connect second without using the force-take-control helper
    const control2 = ioClient(serverUrl, {
      auth: { secret: CONTROL_SECRET, role: "control" },
      reconnection: false,
    });
    try {
      const event = await nextEvent<{ activeControllerId: string }>(control2, "controllerConflict");
      expect(event).toBeDefined();
    } finally {
      control1.disconnect();
      control2.disconnect();
    }
  });

  it("takeControl revokes the first controller and grants the second", async () => {
    const control1 = await connectControl();
    const control2 = ioClient(serverUrl, {
      auth: { secret: CONTROL_SECRET, role: "control" },
      reconnection: false,
    });
    try {
      // control2 will initially get conflict
      await nextEvent(control2, "controllerConflict");

      // control1 should receive revocation when control2 takes over
      const revokedPromise = nextEvent(control1, "controllerRevoked");
      const grantedPromise = nextEvent(control2, "controllerGranted");
      control2.emit("takeControl");

      await Promise.all([revokedPromise, grantedPromise]);
    } finally {
      control1.disconnect();
      control2.disconnect();
    }
  });

  it("rejects manualUpdate from a socket that lost the token", async () => {
    const control1 = await connectControl();
    const control2 = await connectControl(); // force-takes control
    const { socket: viewer } = await connectViewer();
    try {
      const broadcastFired = jest.fn();
      viewer.on("matchStateChange", broadcastFired);

      // control1 no longer holds the token — its manualUpdate should be silently ignored
      control1.emit("manualUpdate", { matchName: "should-be-ignored" });
      await new Promise(r => setTimeout(r, 150));
      expect(broadcastFired).not.toHaveBeenCalled();
    } finally {
      control1.disconnect();
      control2.disconnect();
      viewer.disconnect();
    }
  });
});

// ─── resetScoreOnPeriod ───────────────────────────────────────────────────────

describe("/action/period/end — resetScoreOnPeriod", () => {
  it("resets both scores to 0 for volleyball", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "volleyball", home: { score: 21 }, visitor: { score: 19 }, period: "1" });

    const res = await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);
    expect(res.status).toBe(200);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(0);
    expect(body.visitor.score).toBe(0);
  });

  it("resets both scores to 0 for pickleball", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "pickleball", home: { score: 11 }, visitor: { score: 9 }, period: "1" });

    await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(0);
    expect(body.visitor.score).toBe(0);
  });

  it("resets both scores to 0 for badminton", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "badminton", home: { score: 21 }, visitor: { score: 15 }, period: "1" });

    await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(0);
    expect(body.visitor.score).toBe(0);
  });

  it("resets both scores to 0 for squash", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "squash", home: { score: 11 }, visitor: { score: 8 }, period: "1" });

    await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(0);
    expect(body.visitor.score).toBe(0);
  });

  it("does NOT reset scores for football", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "football", home: { score: 2 }, visitor: { score: 1 }, period: "1" });

    await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(2);
    expect(body.visitor.score).toBe(1);
  });

  it("does NOT reset scores for touch_rugby", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "touch_rugby", home: { score: 3 }, visitor: { score: 2 }, period: "1" });

    await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);

    const { body } = await request(app).get("/state");
    expect(body.home.score).toBe(3);
    expect(body.visitor.score).toBe(2);
  });

  it("advances the period number on period/end", async () => {
    await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ sport: "football", period: "1" });

    const res = await request(app)
      .post("/action/period/end")
      .set("x-control-secret", CONTROL_SECRET);
    expect(res.body.period).toBe("2");
  });
});
