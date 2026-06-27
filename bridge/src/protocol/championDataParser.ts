import { z } from "zod";
import {
  MatchState,
  NetballMatchStats,
  NetballTeamStats,
  NetballPlayerStats,
  TeamPlayer,
  DEFAULT_MATCH_STATE,
} from "../types";

// ─── ChampionData JSON shape (subset we consume) ────────────────────────────
// Validated with zod at this trust boundary (the only place external
// ChampionData JSON enters the system, from either the JSON-poll or scrape
// source) so a malformed/unexpected upstream shape is rejected with a clear
// error here rather than failing late and confusingly inside the toXxx()
// helpers below (SA-6).

const cdPlayerSchema = z.object({
  playerId: z.number(),
  playerName: z.string(),
  playerFirstname: z.string(),
  playerSurname: z.string(),
  currentPosition: z.string(),
  startingPositionCode: z.string(),
  goals: z.number(),
  goalAttempts: z.number(),
  goalMisses: z.number(),
  shootingPercentage: z.number(),
  goalAssists: z.number(),
  feeds: z.number(),
  centrePassReceives: z.number(),
  secondPhaseReceives: z.number(),
  penalties: z.number(),
  obstructionPenalties: z.number(),
  contactPenalties: z.number(),
  intercepts: z.number(),
  deflections: z.number(),
  pickups: z.number(),
  rebounds: z.number(),
  offensiveRebounds: z.number(),
  defensiveRebounds: z.number(),
  turnovers: z.number(),
  gain: z.number(),
  blocked: z.number(),
  blocks: z.number(),
  badPasses: z.number(),
  badHands: z.number(),
  offsides: z.number(),
  breaks: z.number(),
  points: z.number().optional(),
});

const cdTeamSchema = z.object({
  squadId: z.number(),
  squadName: z.string(),
  goals: z.number(),
  goalAttempts: z.number(),
  shootingPercentage: z.number(),
  goalsFromCentrePass: z.number(),
  goalsFromTurnovers: z.number(),
  goalsFromGains: z.number(),
  centrePassReceives: z.number(),
  secondPhaseReceives: z.number(),
  feeds: z.number(),
  penalties: z.number(),
  turnovers: z.number(),
  gain: z.number(),
  rebounds: z.number(),
  offensiveRebounds: z.number(),
  defensiveRebounds: z.number(),
  intercepts: z.number(),
  deflections: z.number(),
  pickups: z.number(),
  blocks: z.number(),
  timeInPossession: z.number(),
  player: z.array(cdPlayerSchema),
});

const cdMatchStatsSchema = z.object({
  matchId: z.number(),
  matchStatus: z.string(),
  period: z.number(),
  periodCompleted: z.number(),
  roundNumber: z.number(),
  homeSquadId: z.number(),
  awaySquadId: z.number(),
  homeSquadName: z.string(),
  awaySquadName: z.string(),
  periodSeconds: z.number(),
  team: z.tuple([cdTeamSchema, cdTeamSchema]),
});

const cdPayloadSchema = z.object({
  sport: z.object({
    netballMatchStats: cdMatchStatsSchema.optional(),
    venueName: z.string().optional(),
    competitionName: z.string().optional(),
  }).optional(),
});

type CdTeam = z.infer<typeof cdTeamSchema>;
type CdPlayer = z.infer<typeof cdPlayerSchema>;

// ─── Public API ──────────────────────────────────────────────────────────────

export function parseChampionDataJson(
  json: unknown,
  existing: MatchState = { ...DEFAULT_MATCH_STATE }
): MatchState {
  const parsed = cdPayloadSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unrecognised ChampionData payload — ${parsed.error.issues[0]?.message ?? "schema mismatch"}`);
  }
  const ms = parsed.data.sport?.netballMatchStats;
  if (!ms) {
    throw new Error("Unrecognised ChampionData payload — missing netballMatchStats.team");
  }

  const [homeTeam, awayTeam] = ms.team;
  const venueName = parsed.data.sport?.venueName ?? "";
  const competitionName = parsed.data.sport?.competitionName ?? "";
  const matchName = competitionName
    ? `${ms.homeSquadName} v ${ms.awaySquadName} — ${competitionName}`
    : `${ms.homeSquadName} v ${ms.awaySquadName}`;

  const isRunning = ms.matchStatus === "inProgress";
  const periodStr = String(ms.period ?? ms.periodCompleted ?? 1);

  // Clock: periodSeconds is the quarter duration; we don't get elapsed time
  // from this feed, so we only update clock from running state.
  const clockSeconds = ms.periodSeconds ?? existing.clockSeconds;

  return {
    ...existing,
    sequenceId: existing.sequenceId + 1,
    sport: "netball",
    matchName,
    period: periodStr,
    isRunning,
    clockSeconds: existing.clockSeconds,
    countDown: true,
    possession: "none",
    home: {
      ...existing.home,
      name: homeTeam.squadName,
      score: homeTeam.goals,
      players: toTeamPlayers(homeTeam.player),
    },
    visitor: {
      ...existing.visitor,
      name: awayTeam.squadName,
      score: awayTeam.goals,
      players: toTeamPlayers(awayTeam.player),
    },
    netballStats: {
      matchId: ms.matchId,
      matchStatus: ms.matchStatus,
      period: ms.period,
      periodCompleted: ms.periodCompleted,
      roundNumber: ms.roundNumber,
      home: toNetballTeamStats(homeTeam),
      visitor: toNetballTeamStats(awayTeam),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTeamPlayers(players: CdPlayer[]): TeamPlayer[] {
  return players
    .filter(p => p.startingPositionCode !== "I" || p.currentPosition !== "I")
    .map(p => ({
      number: p.playerId,
      name: p.playerName,
      onCourt: isOnCourt(p.currentPosition),
      faults: p.penalties,
      points: p.goals,
    }));
}

function isOnCourt(position: string): boolean {
  return position !== "I" && position !== "" && position != null;
}

function toNetballTeamStats(team: CdTeam): NetballTeamStats {
  return {
    squadId: team.squadId,
    squadName: team.squadName,
    goals: team.goals,
    goalAttempts: team.goalAttempts,
    shootingPercentage: team.shootingPercentage,
    goalsFromCentrePass: team.goalsFromCentrePass,
    goalsFromTurnovers: team.goalsFromTurnovers,
    goalsFromGains: team.goalsFromGains,
    centrePassReceives: team.centrePassReceives,
    secondPhaseReceives: team.secondPhaseReceives,
    feeds: team.feeds,
    penalties: team.penalties,
    turnovers: team.turnovers,
    gain: team.gain,
    rebounds: team.rebounds,
    offensiveRebounds: team.offensiveRebounds,
    defensiveRebounds: team.defensiveRebounds,
    intercepts: team.intercepts,
    deflections: team.deflections,
    pickups: team.pickups,
    blocks: team.blocks,
    timeInPossession: team.timeInPossession,
    players: team.player.map(toNetballPlayerStats),
  };
}

function toNetballPlayerStats(p: CdPlayer): NetballPlayerStats {
  return {
    playerId: p.playerId,
    playerName: p.playerName,
    playerFirstname: p.playerFirstname,
    playerSurname: p.playerSurname,
    currentPosition: p.currentPosition,
    startingPositionCode: p.startingPositionCode,
    goals: p.goals,
    goalAttempts: p.goalAttempts,
    goalMisses: p.goalMisses,
    shootingPercentage: p.shootingPercentage,
    goalAssists: p.goalAssists,
    feeds: p.feeds,
    centrePassReceives: p.centrePassReceives,
    secondPhaseReceives: p.secondPhaseReceives,
    penalties: p.penalties,
    obstructionPenalties: p.obstructionPenalties,
    contactPenalties: p.contactPenalties,
    intercepts: p.intercepts,
    deflections: p.deflections,
    pickups: p.pickups,
    rebounds: p.rebounds,
    offensiveRebounds: p.offensiveRebounds,
    defensiveRebounds: p.defensiveRebounds,
    turnovers: p.turnovers,
    gain: p.gain,
    blocked: p.blocked,
    blocks: p.blocks,
    badPasses: p.badPasses,
    badHands: p.badHands,
    offsides: p.offsides,
    breaks: p.breaks,
  };
}
