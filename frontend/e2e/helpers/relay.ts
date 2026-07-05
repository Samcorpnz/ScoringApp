import type { APIRequestContext } from "@playwright/test";

// Mirrors frontend/app/control/lib/relay.ts's default — the e2e suite always
// runs against the docker-compose stack (see playwright.config.ts), where the
// relay is reachable on the host at this fixed port.
export const RELAY_URL = "http://localhost:4000";

// GET /state is public (no secret) — see relay/src/server.ts. Useful for
// asserting on state that has no dedicated data-testid in the UI (e.g.
// possession, which is only reflected as an inline style, not text).
export async function getMatchState(request: APIRequestContext, orgId: string, matchId: string): Promise<any> {
  const res = await request.get(`${RELAY_URL}/state?org=${orgId}&matchId=${matchId}`);
  if (!res.ok()) throw new Error(`getMatchState: ${res.status()} ${await res.text()}`);
  return res.json();
}
