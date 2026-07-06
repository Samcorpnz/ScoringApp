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

export default async function globalSetup(): Promise<void> {
  await Promise.all([
    waitForReady(FRONTEND_URL, "frontend"),
    waitForReady(RELAY_HEALTH_URL, "relay"),
  ]);
}
