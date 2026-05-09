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
  countDown: boolean;
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
  sequenceId: -1,
  clockSeconds: 0,
  countDown: false,
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

export function formatClock(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = totalSeconds < 0 ? "-" : "";
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Use for live display — shows MM:SS above 60s, SS.t below 60s
export function formatClockDisplay(seconds: number): string {
  if (seconds >= 60) return formatClock(Math.floor(seconds));
  const s = Math.floor(seconds);
  const tenths = Math.floor((seconds - s) * 10);
  return `${String(s).padStart(2, "0")}.${tenths}`;
}

export function sportLabel(sport: SportType): string {
  const map: Record<SportType, string> = {
    netball:      "Netball",
    basketball:   "Basketball",
    rugby_union:  "Rugby Union",
    rugby_league: "Rugby League",
    volleyball:   "Volleyball",
    football:     "Football",
    handball:     "Handball",
    hockey:       "Hockey",
    waterpolo:    "Water Polo",
    tennis:       "Tennis",
    custom:       "Custom",
  };
  return map[sport] ?? sport;
}
