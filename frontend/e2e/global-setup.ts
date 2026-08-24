const FRONTEND_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const RELAY_HEALTH_URL = process.env.E2E_RELAY_HEALTH_URL ?? "http://localhost:4000/health";
const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;

async function waitForReady(url: string, label: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`${label} responded with ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `${label} at ${url} did not become ready within ${TIMEOUT_MS}ms (${String(lastError)}).\n` +
    "Run `docker compose up --build` from the repo root before running the E2E suite."
  );
}

// The frontend/relay health checks above only prove those containers are up
// — they don't prove the *host* process running Playwright can reach
// Postgres over the published localhost:5432 port. helpers/billing.ts talks
// to Postgres directly (bypassing the containers) via a separate Prisma
// client built from the host's own DATABASE_URL, and that first connection
// has occasionally raced container/network startup in CI (SA-103), surfacing
// as a raw connection error mid-spec instead of a clear setup failure. Wait
// for it here too, so a slow-to-accept-connections Postgres fails fast in
// globalSetup with a clear message rather than flaking an arbitrary spec.
async function waitForDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("@scorehub/db");
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      lastError = err;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Postgres at DATABASE_URL did not accept connections within ${TIMEOUT_MS}ms (${String(lastError)}).\n` +
    "Run `docker compose up --build` from the repo root before running the E2E suite."
  );
}

export default async function globalSetup(): Promise<void> {
  await Promise.all([
    waitForReady(FRONTEND_URL, "frontend"),
    waitForReady(RELAY_HEALTH_URL, "relay"),
    waitForDatabase(),
  ]);
}
