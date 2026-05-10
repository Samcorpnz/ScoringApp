import {
  MatchState,
  NetballMatchStats,
  NetballTeamStats,
  NetballPlayerStats,
  TeamPlayer,
  DEFAULT_MATCH_STATE,
} from "../types";

// ─── ChampionData JSON shape (subset we consume) ────────────────────────────

interface CdPlayer {
  playerId: number;
  playerName: string;
  playerFirstname: string;
  playerSurname: string;
  currentPosition: string;
  startingPositionCode: string;
  goals: number;
  goalAttempts: number;
  goalMisses: number;
  shootingPercentage: number;
  goalAssists: number;
  feeds: number;
  centrePassReceives: number;
  secondPhaseReceives: number;
  penalties: number;
  obstructionPenalties: number;
  contactPenalties: number;
  intercepts: number;
  deflections: number;
  pickups: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  turnovers: number;
  gain: number;
  blocked: number;
  blocks: number;
  badPasses: number;
  badHands: number;
  offsides: number;
  breaks: number;
  points?: number;
}

interface CdTeam {
  squadId: number;
  squadName: string;
  goals: number;
  goalAttempts: number;
  shootingPercentage: number;
  goalsFromCentrePass: number;
  goalsFromTurnovers: number;
  goalsFromGains: number;
  centrePassReceives: number;
  secondPhaseReceives: number;
  feeds: number;
  penalties: number;
  turnovers: number;
  gain: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  intercepts: number;
  deflections: number;
  pickups: number;
  blocks: number;
  timeInPossession: number;
  player: CdPlayer[];
}

interface CdMatchStats {
  matchId: number;
  matchStatus: string;
  period: number;
  periodCompleted: number;
  roundNumber: number;
  homeSquadId: number;
  awaySquadId: number;
  homeSquadName: string;
  awaySquadName: string;
  periodSeconds: number;
  team: [CdTeam, CdTeam];
}

interface CdPayload {
  sport?: {
    netballMatchStats?: CdMatchStats;
    venueName?: string;
    competitionName?: string;
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function parseChampionDataJson(
  json: unknown,
  existing: MatchState = { ...DEFAULT_MATCH_STATE }
): MatchState {
  const payload = json as CdPayload;
  const ms = payload?.sport?.netballMatchStats;
  if (!ms || !Array.isArray(ms.team) || ms.team.length < 2) {
    throw new Error("Unrecognised ChampionData payload — missing netballMatchStats.team");
  }

  const [homeTeam, awayTeam] = ms.team;
  const venueName = payload.sport?.venueName ?? "";
  const competitionName = payload.sport?.competitionName ?? "";
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
