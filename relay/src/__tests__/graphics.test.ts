import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";
import { MatchState } from "../types";

// Graphics Operator add-on — security boundary tests. A graphics-scoped
// socket must be able to select scenes (setScene/graphicsSceneUpdate) but
// must NEVER be able to reach any scoring-mutation handler (manualUpdate,
// stateUpdate, cricket:*, undo, resetMatch), even though server.ts doesn't
// explicitly "reject" those events for it — they simply have no listener
// registered on a graphics-only socket (see server.ts's isControl/isGraphics
// blocks). This file exercises that boundary directly, plus the "dual-hat"
// case where a control-role operator also drives scenes.

const BRIDGE_SECRET   = "test-bridge-secret";
const CONTROL_SECRET  = "test-control-secret";
const GRAPHICS_SECRET = "test-graphics-secret";

let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-graphics-test-"));
  ({ httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    graphicsSecret: GRAPHICS_SECRET,
    uploadDir,
    controlRateLimit: 1000,
    allowedOrigins: ["http://localhost:3000"],
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

function connectAndWait(role?: "bridge" | "control" | "graphics"): Promise<{ socket: Socket; initialState: MatchState }> {
  const secretFor = { bridge: BRIDGE_SECRET, control: CONTROL_SECRET, graphics: GRAPHICS_SECRET };
  const auth = role ? { secret: secretFor[role], role } : undefined;
  const socket = ioClient(serverUrl, { auth, reconnection: false });
  return new Promise((resolve, reject) => {
    let connected = false;
    let initialState: MatchState | undefined;
    const tryResolve = () => {
      if (connected && initialState !== undefined) resolve({ socket, initialState: initialState! });
    };
    socket.once("matchStateChange", (s: MatchState) => { initialState = s; tryResolve(); });
    socket.on("connect", () => { connected = true; tryResolve(); });
    socket.on("connect_error", reject);
  });
}

async function connectControl(): Promise<Socket> {
  const socket = ioClient(serverUrl, { auth: { secret: CONTROL_SECRET, role: "control" }, reconnection: false });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect_error", reject);
    socket.on("controllerGranted", resolve);
    socket.on("controllerConflict", () => socket.emit("takeControl"));
  });
  return socket;
}

function nextEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>(resolve => socket.once(event, resolve));
}

// Waits for the given event or a timeout, whichever comes first — used to
// assert an event does NOT fire (the timeout path is the expected outcome).
function eventOrTimeout<T = unknown>(socket: Socket, event: string, ms = 300): Promise<T | "timeout"> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    socket.once(event, (payload: T) => { clearTimeout(timer); resolve(payload); });
  });
}

describe("graphics-scoped socket — cannot reach scoring-mutation handlers", () => {
  it("a manualUpdate emitted by a graphics socket never reaches other clients", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    const { socket: viewer } = await connectAndWait();

    const changePromise = eventOrTimeout(viewer, "matchStateChange");
    graphics.emit("manualUpdate", { period: "graphics-should-not-set-this" });
    const result = await changePromise;
    expect(result).toBe("timeout");

    graphics.disconnect();
    viewer.disconnect();
  });

  it("a stateUpdate emitted by a graphics socket never reaches other clients", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    const { socket: viewer } = await connectAndWait();

    const changePromise = eventOrTimeout(viewer, "matchStateChange");
    graphics.emit("stateUpdate", { sequenceId: 999, matchName: "should-not-apply" });
    const result = await changePromise;
    expect(result).toBe("timeout");

    graphics.disconnect();
    viewer.disconnect();
  });

  it("resetMatch, undo, and cricket:ball emitted by a graphics socket are all no-ops", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    const { socket: viewer } = await connectAndWait();

    for (const [event, payload] of [
      ["resetMatch", undefined],
      ["undo", undefined],
      ["cricket:ball", { battingTeam: "home", runs: 4, isWicket: false }],
    ] as const) {
      const changePromise = eventOrTimeout(viewer, "matchStateChange");
      graphics.emit(event, payload);
      const result = await changePromise;
      expect(result).toBe("timeout");
    }

    graphics.disconnect();
    viewer.disconnect();
  });

  it("an unentitled/unrecognised graphics secret connects as a plain viewer, not a graphics socket", async () => {
    const socket = ioClient(serverUrl, { auth: { secret: "wrong-secret", role: "graphics" }, reconnection: false });
    await new Promise<void>((resolve, reject) => {
      socket.once("matchStateChange", () => resolve());
      socket.on("connect_error", reject);
    });
    // Falls through to a normal viewer connection (no error) — but still
    // cannot setScene, since neither isControl nor isGraphics was set.
    const changePromise = eventOrTimeout(socket, "graphicsSceneUpdate");
    socket.emit("setScene", { sceneType: "lowerThird" });
    expect(await changePromise).toBe("timeout");
    socket.disconnect();
  });
});

describe("graphics-scoped socket — scene selection works", () => {
  it("a graphics socket can setScene and all room members receive graphicsSceneUpdate", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    const { socket: viewer } = await connectAndWait();

    const scenePromise = nextEvent<{ sceneType: string; payload?: unknown; updatedAt: string }>(viewer, "graphicsSceneUpdate");
    graphics.emit("setScene", { sceneType: "playerStatCard", payload: { playerId: "80710" } });
    const scene = await scenePromise;

    expect(scene.sceneType).toBe("playerStatCard");
    expect((scene.payload as { playerId: string }).playerId).toBe("80710");
    expect(typeof scene.updatedAt).toBe("string");

    graphics.disconnect();
    viewer.disconnect();
  });

  it("a control socket may also drive scenes solo (dual-hat small venues)", async () => {
    const control = await connectControl();
    const { socket: viewer } = await connectAndWait();

    const scenePromise = nextEvent(viewer, "graphicsSceneUpdate");
    control.emit("setScene", { sceneType: "lowerThird" });
    const scene = await scenePromise as { sceneType: string };
    expect(scene.sceneType).toBe("lowerThird");

    control.disconnect();
    viewer.disconnect();
  });

  it("a newly-connecting socket replays the room's last-selected scene", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    graphics.emit("setScene", { sceneType: "headshotBio", payload: { playerId: "1003479" } });
    // Give the relay a tick to apply setScene before the next socket connects.
    await new Promise(resolve => setTimeout(resolve, 50));

    const late = ioClient(serverUrl, { reconnection: false });
    const replayed = await new Promise<{ sceneType: string }>(resolve => {
      late.once("graphicsSceneUpdate", resolve);
    });
    expect(replayed.sceneType).toBe("headshotBio");

    graphics.disconnect();
    late.disconnect();
  });

  it("rejects a malformed setScene payload without crashing or broadcasting", async () => {
    const { socket: graphics } = await connectAndWait("graphics");
    const { socket: viewer } = await connectAndWait();

    const changePromise = eventOrTimeout(viewer, "graphicsSceneUpdate");
    graphics.emit("setScene", { sceneType: 12345 });
    expect(await changePromise).toBe("timeout");

    graphics.disconnect();
    viewer.disconnect();
  });
});
