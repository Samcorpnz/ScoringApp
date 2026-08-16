import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";

// Regression coverage for the same "don't fall through to LEGACY_ROOM_ID
// once DATABASE_URL is set" guard the /state REST route already had —
// see server.ts's io.use() handshake. Without it, a viewer socket that
// connects with no org/matchId (e.g. a display page whose query params
// aren't ready yet) would repeatedly try to persist a Match row under the
// non-existent "legacy-single-tenant" org and throw a foreign-key
// violation on every connection attempt.

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  // Multi-tenant mode: DATABASE_URL set, so LEGACY_ROOM_ID is no longer a
  // valid fallback org. Nothing in these tests reaches a real DB query —
  // the guard under test rejects the connection before any prisma call.
  process.env.DATABASE_URL = "postgresql://fake-for-tests";
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-unscoped-viewer-test-"));
  ({ httpServer, close: closeServer } = createServer({
    bridgeSecret: "test-bridge-secret",
    controlSecret: "test-control-secret",
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
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

function connect(auth?: Record<string, unknown>): Socket {
  return ioClient(serverUrl, { auth, reconnection: false });
}

// socket.disconnect() doesn't wait for the underlying transport to actually
// close — over polling that's a pending XHR, which can otherwise fire after
// Jest has torn down the module registry once afterAll closes the server.
// A socket that never connected (e.g. rejected with connect_error) has no
// live transport to tear down and never emits "disconnect", so only wait
// for it when there's actually a connection to close.
function disconnectAndWait(socket: Socket): Promise<void> {
  if (!socket.connected) {
    socket.disconnect();
    return Promise.resolve();
  }
  return new Promise(resolve => {
    socket.on("disconnect", () => resolve());
    socket.disconnect();
  });
}

describe("unscoped viewer connections once DATABASE_URL is set", () => {
  it("rejects a viewer socket with no org and no matchId", async () => {
    const socket = connect();
    const err = await new Promise<Error>((resolve, reject) => {
      socket.on("connect_error", resolve);
      socket.on("connect", () => reject(new Error("expected connect_error, got connect")));
    });
    expect(err.message).toMatch(/org.*required/i);
    await disconnectAndWait(socket);
  });

  it("still connects a viewer socket that supplies an org", async () => {
    const socket = connect({ orgId: "some-real-org" });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });
    expect(socket.connected).toBe(true);
    await disconnectAndWait(socket);
  });
});
