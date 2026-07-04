"use client";

import { useEffect, useState } from "react";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

export interface RosterPlayer {
  externalId: string | null;
  provider: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
}

// Fetches the org's roster once from the relay's public /api/graphics/roster
// route (same unauthenticated trust level as /api/graphics/entitlement,
// since /display/graphics is an OBS Browser Source with no session) so scene
// components can resolve a live graphicsFeed player to a photo/bio.
export function useRoster(org?: string | null): RosterPlayer[] {
  const [players, setPlayers] = useState<RosterPlayer[]>([]);

  useEffect(() => {
    const url = org ? `${RELAY_URL}/api/graphics/roster?org=${encodeURIComponent(org)}` : `${RELAY_URL}/api/graphics/roster`;
    fetch(url)
      .then(res => res.json())
      .then(data => setPlayers(Array.isArray(data.players) ? data.players : []))
      .catch(() => setPlayers([]));
  }, [org]);

  return players;
}

// Matches a live feed player (bridge/src/graphics/feedTransform.ts's id,
// which is the provider's externalId) against the fetched roster. Provider
// isn't known on the feed-player object itself, so this matches on
// externalId alone — fine in practice since a single org/match runs one
// provider at a time.
export function findRosterMatch(players: RosterPlayer[], feedPlayerId: string | undefined): RosterPlayer | undefined {
  if (!feedPlayerId) return undefined;
  return players.find(p => p.externalId === feedPlayerId);
}
