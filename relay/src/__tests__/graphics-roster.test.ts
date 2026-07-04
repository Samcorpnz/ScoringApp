import request from "supertest";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";

// Phase C — player photo upload + public roster read route. Runs in legacy
// single-tenant mode (no DATABASE_URL), same as relay.test.ts, so
// requireAddOn("graphics-operator") no-ops and /api/graphics/roster returns
// an empty list (no Prisma Player model to query without DATABASE_URL) —
// this file only exercises auth/shape, not add-on gating itself (that's
// covered directly in graphics-entitlements.test.ts).

const BRIDGE_SECRET  = "test-bridge-secret";
const CONTROL_SECRET = "test-control-secret";

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-roster-test-"));
  ({ app, httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    uploadDir,
    controlRateLimit: 1000,
    allowedOrigins: ["http://localhost:3000"],
  }));
  httpServer.listen(0, () => done());
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

describe("POST /api/player-photo/:playerId", () => {
  it("rejects upload without a control secret", async () => {
    const res = await request(app)
      .post("/api/player-photo/player-1")
      .attach("photo", Buffer.from([0x89, 0x50, 0x4e, 0x47]), "photo.png");
    expect(res.status).toBe(401);
  });

  it("uploads a photo and returns a URL scoped to the player id, then removes it", async () => {
    const upload = await request(app)
      .post("/api/player-photo/player-1")
      .set("x-control-secret", CONTROL_SECRET)
      .attach("photo", Buffer.from([0x89, 0x50, 0x4e, 0x47]), "photo.png");
    expect(upload.status).toBe(200);
    expect(upload.body.photoUrl).toMatch(/player-1/);

    const del = await request(app)
      .delete("/api/player-photo/player-1")
      .set("x-control-secret", CONTROL_SECRET);
    expect(del.status).toBe(200);
  });
});

describe("GET /api/graphics/roster", () => {
  it("is public (no secret required) and returns a players array", async () => {
    const res = await request(app).get("/api/graphics/roster?org=some-org");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.players)).toBe(true);
  });
});
