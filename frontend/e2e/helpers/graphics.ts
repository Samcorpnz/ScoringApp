import type { Page } from "@playwright/test";
import { RELAY_URL } from "./relay";
import type { GraphicsFeed } from "../../app/types";

export async function getControlToken(page: Page, matchId: string): Promise<string> {
  const res = await page.request.get(`/api/control-token?matchId=${matchId}`);
  if (!res.ok()) throw new Error(`getControlToken: ${res.status()} ${await res.text()}`);
  const { token } = await res.json();
  return token;
}

// Simulates a live ChampionData-style provider feed by POSTing directly to
// the relay's /manual endpoint (the same one the bridge's mock/real sources
// use to push a MatchState patch) — /control/graphics has nothing to click
// on for Player Stat Cards/Headshot+Bio until state.graphicsFeed.stats.players
// is non-empty, and there's no real bridge/provider available in this suite.
export async function pushGraphicsFeed(
  page: Page,
  matchId: string,
  controlToken: string,
  feed: GraphicsFeed
): Promise<void> {
  const res = await page.request.post(`${RELAY_URL}/manual`, {
    headers: { "x-control-secret": controlToken },
    data: { graphicsFeed: feed },
  });
  if (!res.ok()) throw new Error(`pushGraphicsFeed: ${res.status()} ${await res.text()}`);
}

// Creates a roster Player row directly via the frontend's API (rather than
// driving the "+ Add Player" modal), matched to a pushGraphicsFeed player by
// externalId — findRosterMatch() (frontend/app/hooks/useRoster.ts) joins on
// externalId alone, so provider only needs to be *some* consistent value.
export async function addRosterPlayer(
  page: Page,
  orgId: string,
  opts: { firstName: string; lastName: string; externalId: string; provider?: string; displayName?: string }
): Promise<string> {
  const res = await page.request.post(`/api/orgs/${orgId}/players`, {
    data: {
      firstName: opts.firstName,
      lastName: opts.lastName,
      externalId: opts.externalId,
      provider: opts.provider ?? "e2e-mock-provider",
      displayName: opts.displayName,
    },
  });
  if (!res.ok()) throw new Error(`addRosterPlayer: ${res.status()} ${await res.text()}`);
  const { player } = await res.json();
  return player.id as string;
}
