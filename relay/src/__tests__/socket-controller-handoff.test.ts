import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { SignJWT } from "jose";

// `@scorehub/db` is mocked (same approach as entitlements.test.ts) because a
// resolvable orgId here lets the control socket's connection through far
// enough to call getState -> persistence.ts's resolveMatch, which would
// otherwise try a real Prisma query against the fake DATABASE_URL below —
// non-deterministically hanging or crashing the process on teardown
// depending on DNS/network state, rather than failing fast and predictably.
jest.mock("@scorehub/db", () => ({
  prisma: {
    org: {
      findUnique: jest.fn(async () => null), // no org row -> getOrgAccount returns null -> not free-tier-gated
    },
    match: {
      findFirst: jest.fn(async () => null), // no existing LIVE match -> falls through to create
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, orgId: "unused", state: null })),
      create: jest.fn(async ({ data }: { data: { orgId: string } }) => ({ id: `match-${data.orgId}`, orgId: data.orgId })),
      update: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      count: jest.fn(async () => 0),
    },
  },
}));

import { createServer } from "../server";

// Regression coverage for SA-102: /setup navigating into /control opens a
// brand-new control socket while the old one is still inside its 30s
// post-disconnect controller-token grace period (see server.ts's
// controllerTokens/CONTROLLER_TOKEN_TTL_MS). Without an identity check, the
// new socket looked identical to a rival controller and got
// "controllerConflict" instead of being handed control — landing the
// operator in "VIEWING ONLY" on the match they just created. Once
// DATABASE_URL is set, control sockets authenticate with a JWT carrying the
// logged-in user's id (`sub`), which the mutex now uses to recognize this as
// the same operator's replacement connection.

const AUTH_SECRET = "test-auth-secret-for-handoff";
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;

let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  process.env.DATABASE_URL = "postgresql://fake-for-tests";
  process.env.AUTH_SECRET = AUTH_SECRET;
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-controller-handoff-test-"));
  ({ httpServer, close: closeServer } = createServer({
    bridgeSecret: "test-bridge-secret",
    controlSecret: "test-control-secret",
    uploadDir,
    controlRateLimit: 1000,
    allowedOrigins: ["http://localhost:3000"],
    // Long enough that the grace-period window under test can't flake shut
    // before the second socket connects, short enough the suite stays fast.
    controllerTokenTtlMs: 5_000,
  }));
  httpServer.listen(0, () => {
    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll(done => {
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

function controlToken(orgId: string, userId: string): Promise<string> {
  return new SignJWT({ orgId, role: "OPERATOR" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(AUTH_SECRET));
}

function connectControlSocket(token: string): Socket {
  return ioClient(serverUrl, { auth: { secret: token, role: "control" }, reconnection: false });
}

function waitForEvent(socket: Socket, event: "controllerGranted" | "controllerConflict"): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once(event, resolve);
    socket.once("connect_error", reject);
  });
}

describe("controller mutex handoff across a page navigation (SA-102)", () => {
  it("grants control immediately to the same operator's new socket, even while the old socket's grace-period token is still held", async () => {
    const org = "org-handoff-same-user";
    const user = "user-1";

    const first = connectControlSocket(await controlToken(org, user));
    await waitForEvent(first, "controllerGranted");
    first.disconnect(); // starts the grace-period TTL, token stays held under user-1

    const second = connectControlSocket(await controlToken(org, user));
    const event = await Promise.race([
      waitForEvent(second, "controllerGranted").then(() => "granted"),
      waitForEvent(second, "controllerConflict").then(() => "conflict"),
    ]);
    expect(event).toBe("granted");
    second.disconnect();
  });

  it("still conflicts a genuinely different operator during the grace period", async () => {
    const org = "org-handoff-diff-user";

    const first = connectControlSocket(await controlToken(org, "user-a"));
    await waitForEvent(first, "controllerGranted");
    first.disconnect();

    const second = connectControlSocket(await controlToken(org, "user-b"));
    const event = await Promise.race([
      waitForEvent(second, "controllerGranted").then(() => "granted"),
      waitForEvent(second, "controllerConflict").then(() => "conflict"),
    ]);
    expect(event).toBe("conflict");
    second.disconnect();
  });

  it("still conflicts a second tab from the SAME operator while the first tab's socket is still live (not disconnected)", async () => {
    // Regression guard for the fix above: the same-operator handoff must
    // only kick in once the prior socket has actually disconnected (grace
    // period). Two tabs open concurrently under the same login is exactly
    // what the mutex exists to prevent — see adversarial.spec.ts's "two tabs
    // on the same match" E2E test, which this mirrors at the relay level.
    const org = "org-handoff-two-tabs-same-user";
    const user = "user-two-tabs";

    const first = connectControlSocket(await controlToken(org, user));
    await waitForEvent(first, "controllerGranted");
    // No disconnect — first tab stays connected, holding the token with expiresAt: Infinity.

    const second = connectControlSocket(await controlToken(org, user));
    const event = await Promise.race([
      waitForEvent(second, "controllerGranted").then(() => "granted"),
      waitForEvent(second, "controllerConflict").then(() => "conflict"),
    ]);
    expect(event).toBe("conflict");
    first.disconnect();
    second.disconnect();
  });
});
