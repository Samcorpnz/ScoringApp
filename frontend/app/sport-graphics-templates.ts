import type { SportType } from "./types";

/**
 * Per-sport display labels/ordering for Graphics Operator scenes
 * (display/graphics/scenes/*). Sibling to sport-templates.ts rather than a
 * field on SportTemplate, since only sports with a wired graphics-feed
 * mapping (bridge/src/graphics/feedMappings/*.json) need one — most sports
 * fall back to a generic camelCase-split label and unordered stat list.
 */
export interface SportGraphicsTemplate {
  statLabels: Record<string, string>;
  /** Ordered team-level stat keys shown in the lower-third (kept short). */
  lowerThirdStats: string[];
  /** Ordered player stat keys shown on the player stat card. */
  playerCardStats: string[];
}

export const SPORT_GRAPHICS_TEMPLATES: Partial<Record<SportType, SportGraphicsTemplate>> = {
  netball: {
    statLabels: {
      goals: "Goals",
      goalAttempts: "Attempts",
      shootingPercentage: "Shooting %",
      goalsFromCentrePass: "From Centre Pass",
      goalsFromTurnovers: "From Turnovers",
      feeds: "Feeds",
      centrePassReceives: "Centre Pass Receives",
      penalties: "Penalties",
      turnovers: "Turnovers",
      gain: "Gain",
      rebounds: "Rebounds",
      intercepts: "Intercepts",
      deflections: "Deflections",
      pickups: "Pickups",
      goalAssists: "Assists",
      position: "Position",
    },
    lowerThirdStats: ["shootingPercentage", "goalAttempts", "feeds"],
    playerCardStats: [
      "position", "goals", "goalAttempts", "shootingPercentage", "goalAssists",
      "feeds", "centrePassReceives", "intercepts", "deflections", "rebounds", "turnovers",
    ],
  },
  basketball: {
    statLabels: {
      points: "Points",
      fieldGoalsMade: "FG Made",
      fieldGoalsAttempted: "FG Attempted",
      fieldGoalPercentage: "FG %",
      threePointsMade: "3PT Made",
      threePointsAttempted: "3PT Attempted",
      freeThrowsMade: "FT Made",
      freeThrowsAttempted: "FT Attempted",
      rebounds: "Rebounds",
      offensiveRebounds: "Off. Rebounds",
      defensiveRebounds: "Def. Rebounds",
      assists: "Assists",
      steals: "Steals",
      blocks: "Blocks",
      turnovers: "Turnovers",
      personalFouls: "Fouls",
      plusMinus: "+/-",
      minutesPlayed: "Minutes",
      position: "Position",
    },
    lowerThirdStats: ["fieldGoalPercentage", "rebounds", "assists"],
    playerCardStats: [
      "position", "points", "fieldGoalsMade", "fieldGoalsAttempted", "threePointsMade",
      "freeThrowsMade", "rebounds", "assists", "steals", "blocks", "turnovers", "plusMinus",
    ],
  },
  cricket: {
    statLabels: {
      runs: "Runs",
      wickets: "Wickets",
      overs: "Overs",
      runRate: "Run Rate",
      extras: "Extras",
      fours: "Fours",
      sixes: "Sixes",
      battingRuns: "Runs",
      ballsFaced: "Balls Faced",
      battingFours: "Fours",
      battingSixes: "Sixes",
      strikeRate: "Strike Rate",
      bowlingOvers: "Overs",
      bowlingWickets: "Wickets",
      bowlingRuns: "Runs Conceded",
      economyRate: "Economy",
      catches: "Catches",
    },
    lowerThirdStats: ["runs", "wickets", "runRate"],
    playerCardStats: [
      "battingRuns", "ballsFaced", "strikeRate", "battingFours", "battingSixes",
      "bowlingOvers", "bowlingWickets", "economyRate", "catches",
    ],
  },
};

export function getGraphicsTemplate(sport: SportType): SportGraphicsTemplate | undefined {
  return SPORT_GRAPHICS_TEMPLATES[sport];
}

function defaultStatLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}

export function formatStatLabel(sport: SportType, key: string): string {
  return SPORT_GRAPHICS_TEMPLATES[sport]?.statLabels[key] ?? defaultStatLabel(key);
}

/**
 * Orders/filters a flattened stat bag per the sport's template, falling back
 * to natural object order (minus excludeKeys) when no template exists yet.
 */
export function orderStats(
  sport: SportType,
  stats: Record<string, number | string> | undefined,
  pick: "lowerThirdStats" | "playerCardStats",
  excludeKeys: string[] = []
): [string, number | string][] {
  if (!stats) return [];
  const template = SPORT_GRAPHICS_TEMPLATES[sport];
  const entries = Object.entries(stats).filter(([key]) => !excludeKeys.includes(key));
  if (!template) return entries;

  const order = template[pick];
  const ranked = order
    .filter(key => key in stats)
    .map((key): [string, number | string] => [key, stats[key]]);
  const remaining = entries.filter(([key]) => !order.includes(key));
  return [...ranked, ...remaining];
}
