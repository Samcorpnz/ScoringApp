import request from "supertest";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";

// Isolated in its own file/server instance (default controlRateLimit) so it
// doesn't share a request budget with relay.test.ts's much larger set of
// route tests (SA-11/SA-81).
const CONTROL_SECRET = "ratelimit-test-secret";
const BRIDGE_SECRET = "ratelimit-test-bridge-secret";

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-ratelimit-test-"));
  ({ app, httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    uploadDir,
    allowedOrigins: ["http://localhost:3000"],
  }));
  httpServer.listen(0, () => done());
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

describe("controlRateLimit on /manual (SA-81)", () => {
  it("allows up to the configured limit, then rejects with 429", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post("/manual")
        .set("x-control-secret", CONTROL_SECRET)
        .send({ matchName: `req-${i}` });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(200);

    const blocked = await request(app)
      .post("/manual")
      .set("x-control-secret", CONTROL_SECRET)
      .send({ matchName: "one-too-many" });
    expect(blocked.status).toBe(429);
  });

  it("counts unauthenticated requests against the same limit (must run before auth)", async () => {
    const res = await request(app)
      .post("/manual")
      .send({ matchName: "still-blocked" });
    expect(res.status).toBe(429);
  });
});
