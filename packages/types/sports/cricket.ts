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
  thisOverBalls: string[];
  declared?: boolean;
  // True when the delivery about to be bowled is a free hit (the ball
  // after a no-ball) — the batter can only be dismissed run out. Cleared
  // after the next ball, legal or not.
  freeHit?: boolean;
  // Total runs conceded from any source (bat, byes, leg-byes, wides,
  // no-balls) since the over began — reset alongside ballsThisOver.
  // Zero when the over completes means a maiden. Optional/undefined is
  // treated as 0 so existing callers that don't set it aren't broken.
  runsConcededThisOver?: number;
}

export type CricketSession = "morning" | "afternoon" | "evening";

export interface CricketState {
  sport: "cricket";
  format: CricketFormat;
  inningsNumber: number;
  innings: CricketInningsState[];
  homeSquad: { id: number; name: string }[];
  visitorSquad: { id: number; name: string }[];
  dayNumber?: number;
  session?: CricketSession;
}

export interface CricketBallEvent {
  battingTeam: "home" | "visitor";
  runs: number;
  isWicket: boolean;
  wicketType?: WicketType;
  isWide?: boolean;
  isNoBall?: boolean;
  isBye?: boolean;
  isLegBye?: boolean;
  // Index into the current innings' batters array — supplied in the same
  // event as the dismissal so the incoming batter is set in one round trip.
  nextBatterIndex?: number;
}
