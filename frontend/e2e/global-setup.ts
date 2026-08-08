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

// helpers/billing.ts (used by the Logos/Sounds and Graphics specs) connects
// straight to Postgres from this host process, bypassing Stripe. If
// DATABASE_URL isn't exported for this shell — or points at frontend/
// .env.local's cloud database instead of docker-compose's local Postgres —
// the failure doesn't surface here; it shows up three layers deep as a
// cryptic `pg`/SASL error ("client password must be a string") the first
// time grantPlan/grantAddOn tries to connect, which is confusing to debug
// from inside an unrelated-looking spec. Catch it up front instead.
function checkDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set for this shell. helpers/billing.ts (used by " +
      "the Logos/Sounds and Graphics specs) needs it to write plan state " +
      "directly to Postgres. Export it before running the suite:\n" +
      "  DATABASE_URL=postgresql://scorehub:scorehub@localhost:5432/scorehub npm run test:e2e"
    );
  }
  if (!/^postgresql:\/\/[^/]*@(localhost|127\.0\.0\.1):/.test(url)) {
    throw new Error(
      `DATABASE_URL (${url}) does not point at localhost. helpers/billing.ts runs on the ` +
      "host, not inside docker-compose's network, so it must use the port mapped to the " +
      "host (postgresql://scorehub:scorehub@localhost:5432/scorehub), not the in-container " +
      "hostname or a cloud database from frontend/.env.local."
    );
  }
}

export default async function globalSetup(): Promise<void> {
  checkDatabaseUrl();
  await Promise.all([
    waitForReady(FRONTEND_URL, "frontend"),
    waitForReady(RELAY_HEALTH_URL, "relay"),
  ]);
}
