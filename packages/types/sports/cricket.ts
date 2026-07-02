export type CricketFormat = "t20" | "odi" | "test";
export type WicketType = "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket" | "obstructed_field" | "handled_ball";

export interface CricketBatter {
  playerId: number;
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  dismissed: boolean;
  wicketType?: WicketType;
}

export interface CricketBowler {
  playerId: number;
  name: string;
  overs: number;
  ballsThisOver: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface CricketInningsState {
  battingTeam: "home" | "visitor";
  runs: number;
  wickets: number;
  oversComplete: number;
  ballsThisOver: number;
  extras: { wides: number; noBalls: number; byes: number; legByes: number; penalties: number };
  batters: CricketBatter[];
  bowlers: CricketBowler[];
  currentBatter1Index: number;
  currentBatter2Index: number;
  currentBowlerIndex: number;
  target?: number;
}

export interface CricketState {
  sport: "cricket";
  format: CricketFormat;
  inningsNumber: number;
  innings: CricketInningsState[];
  homeSquad: { id: number; name: string }[];
  visitorSquad: { id: number; name: string }[];
}
