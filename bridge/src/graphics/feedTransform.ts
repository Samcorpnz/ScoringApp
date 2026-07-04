/**
 * Generic, provider-agnostic stat-feed flattener for the Graphics Operator add-on.
 *
 * Score-critical state (bridge/src/protocol/championDataParser.ts) is strictly
 * zod-validated per sport/provider, because a malformed field there breaks the
 * scoreboard. Graphics-only stats deliberately take the opposite tradeoff: a
 * declarative field-mapping config (bridge/src/graphics/feedMappings/*.json)
 * describes *where* to find stats in a raw provider payload, so adding a sport
 * or reacting to a provider renaming a field is a JSON edit, not a bridge
 * redeploy. applyFeedMapping() never throws — a missing/renamed path just
 * yields a blank stat, it never affects scoring.
 */

export interface FeedFieldMapping {
  /** Dot-path to the value, relative to the team or player object. */
  path: string;
  /** Normalized output key used by display scene components. */
  statKey: string;
}

export interface FeedMapping {
  provider: string;
  sport: string;
  /** Dot-path into the raw payload to a 2-element [home, visitor] team array. */
  teamsPath: string;
  /** Dot-path *within a team object* to its players array. */
  playersPath: string;
  /** Field within a player object holding a stable provider player id. */
  playerIdField: string;
  /** Field within a player object holding a display name. */
  playerNameField: string;
  teamFields: FeedFieldMapping[];
  playerFields: FeedFieldMapping[];
}

export interface GraphicsPlayerStats {
  id: string;
  name: string;
  team: "home" | "visitor";
  stats: Record<string, number | string>;
}

export interface GraphicsStatBag {
  team: {
    home: Record<string, number | string>;
    visitor: Record<string, number | string>;
  };
  players: GraphicsPlayerStats[];
}

export interface GraphicsFeed {
  provider: string;
  sport: string;
  version: number;
  capturedAt: string;
  stats: GraphicsStatBag;
}

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function extractFields(obj: unknown, fields: FeedFieldMapping[]): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const field of fields) {
    const value = getPath(obj, field.path);
    if (typeof value === "number" || typeof value === "string") {
      out[field.statKey] = value;
    }
  }
  return out;
}

function extractPlayers(
  teamRaw: unknown,
  mapping: FeedMapping,
  team: "home" | "visitor"
): GraphicsPlayerStats[] {
  const playersRaw = getPath(teamRaw, mapping.playersPath);
  if (!Array.isArray(playersRaw)) return [];

  return playersRaw
    .map((p): GraphicsPlayerStats | undefined => {
      const id = getPath(p, mapping.playerIdField);
      const name = getPath(p, mapping.playerNameField);
      if (typeof id !== "number" && typeof id !== "string") return undefined;
      return {
        id: String(id),
        name: typeof name === "string" ? name : "",
        team,
        stats: extractFields(p, mapping.playerFields),
      };
    })
    .filter((p): p is GraphicsPlayerStats => p !== undefined);
}

/**
 * Walks `raw` per `mapping`'s declared paths. Returns undefined (not a throw)
 * if the payload doesn't match the mapping's expected shape at all — callers
 * should treat that as "no graphics feed this poll", not an error.
 */
export function applyFeedMapping(raw: unknown, mapping: FeedMapping): GraphicsStatBag | undefined {
  const teamsRaw = getPath(raw, mapping.teamsPath);
  if (!Array.isArray(teamsRaw) || teamsRaw.length < 2) return undefined;

  const [homeRaw, visitorRaw] = teamsRaw;
  return {
    team: {
      home: extractFields(homeRaw, mapping.teamFields),
      visitor: extractFields(visitorRaw, mapping.teamFields),
    },
    players: [
      ...extractPlayers(homeRaw, mapping, "home"),
      ...extractPlayers(visitorRaw, mapping, "visitor"),
    ],
  };
}

/**
 * Convenience wrapper producing a full GraphicsFeed envelope (with version =
 * bumped from the previous feed, or 1 for the first successful mapping).
 */
export function buildGraphicsFeed(
  raw: unknown,
  mapping: FeedMapping,
  previousVersion: number
): GraphicsFeed | undefined {
  const stats = applyFeedMapping(raw, mapping);
  if (!stats) return undefined;
  return {
    provider: mapping.provider,
    sport: mapping.sport,
    version: previousVersion + 1,
    capturedAt: new Date().toISOString(),
    stats,
  };
}
