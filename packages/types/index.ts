export interface TeamPlayer {
  number: number;
  name: string;
  onCourt: boolean;
  faults: number;
  points: number;
}

export interface TeamState {
  name: string;
  score: number;
  faults: number;
  timeouts: number;
  players: TeamPlayer[];
  color: string;
  logoUrl: string;
}

export type Possession = "home" | "visitor" | "both" | "none";

export type SportType =
  | "netball" | "basketball"
  | "rugby_union" | "rugby_league"
  | "volleyball" | "football"
  | "handball" | "hockey" | "waterpolo" | "tennis"
  | "touch_rugby" | "futsal" | "pickleball" | "badminton"
  | "table_tennis" | "floorball" | "squash" | "lawn_bowls"
  | "indoor_cricket" | "softball" | "cricket"
  | "custom";

export interface NetballPlayerStats {
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
}

export interface NetballTeamStats {
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
  players: NetballPlayerStats[];
}

export interface NetballMatchStats {
  matchId: number;
  matchStatus: string;
  period: number;
  periodCompleted: number;
  roundNumber: number;
  home: NetballTeamStats;
  visitor: NetballTeamStats;
}

export interface DisplayTheme {
  primaryColor: string;
  backgroundColor: string;
  font: string;
  textScale: number;
  competitionLogoUrl: string;
}

export const DEFAULT_DISPLAY_THEME: DisplayTheme = {
  primaryColor: "#00C8FF",
  backgroundColor: "#07090F",
  font: "",
  textScale: 1,
  competitionLogoUrl: "",
};

export type { IndoorCricketState } from "./sports/indoor_cricket";
export type { SoftballState, SoftballFormat } from "./sports/softball";
export type {
  CricketState,
  CricketFormat,
  CricketInningsState,
  CricketBatter,
  CricketBowler,
  WicketType,
  CricketBallEvent,
  CricketSession,
} from "./sports/cricket";

import type { IndoorCricketState } from "./sports/indoor_cricket";
import type { SoftballState } from "./sports/softball";
import type { CricketState } from "./sports/cricket";

export type SportState = IndoorCricketState | SoftballState | CricketState;

export interface MatchState {
  sequenceId: number;
  clockSeconds: number;
  countDown: boolean;
  period: string;
  periodBreak: boolean;
  matchName: string;
  isRunning: boolean;
  possession: Possession;
  hornActive: boolean;
  sport: SportType;
  inputSource: string;
  home: TeamState;
  visitor: TeamState;
  netballStats?: NetballMatchStats;
  sportState?: SportState;
  sportConfig?: Record<string, unknown>;
  displayTheme: DisplayTheme;
}
