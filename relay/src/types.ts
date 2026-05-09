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
  | "handball" | "hockey" | "waterpolo" | "tennis" | "custom";

export interface MatchState {
  sequenceId: number;
  clockSeconds: number;
  period: string;
  matchName: string;
  isRunning: boolean;
  possession: Possession;
  hornActive: boolean;
  sport: SportType;
  inputSource: string;
  home: TeamState;
  visitor: TeamState;
}

export const DEFAULT_MATCH_STATE: MatchState = {
  sequenceId: 0,
  clockSeconds: 0,
  period: "1",
  matchName: "",
  isRunning: false,
  possession: "none",
  hornActive: false,
  sport: "netball",
  inputSource: "none",
  home:    { name: "Home",    score: 0, faults: 0, timeouts: 0, players: [], color: "#F59E0B", logoUrl: "" },
  visitor: { name: "Visitor", score: 0, faults: 0, timeouts: 0, players: [], color: "#818CF8", logoUrl: "" },
};
