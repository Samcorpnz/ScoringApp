export interface TeamState {
  name: string;
  score: number;
  color: string;
}

export interface MatchState {
  isRunning: boolean;
  clockSeconds: number;
  period: string;
  home: TeamState;
  visitor: TeamState;
}

export interface GlobalSettings {
  relayUrl: string;
  token: string;
  orgId?: string;
  matchId?: string | null;
  connected?: boolean;
}

export interface ScoreSettings {
  team?: "home" | "visitor";
  delta?: number;
}

export interface PeriodSettings {
  direction?: "next" | "prev";
}
