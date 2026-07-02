export type {
  TeamPlayer,
  TeamState,
  Possession,
  SportType,
  NetballPlayerStats,
  NetballTeamStats,
  NetballMatchStats,
  DisplayTheme,
  MatchState,
} from "@scorehub/types";

export { DEFAULT_DISPLAY_THEME } from "@scorehub/types";

export const DEFAULT_MATCH_STATE = {
  sequenceId: 0,
  clockSeconds: 0,
  countDown: false,
  period: "1",
  periodBreak: false,
  matchName: "",
  isRunning: false,
  possession: "none" as const,
  hornActive: false,
  sport: "netball" as const,
  inputSource: "none",
  home:    { name: "Home",    score: 0, faults: 0, timeouts: 0, players: [], color: "#F59E0B", logoUrl: "" },
  visitor: { name: "Visitor", score: 0, faults: 0, timeouts: 0, players: [], color: "#818CF8", logoUrl: "" },
  displayTheme: { primaryColor: "#00C8FF", backgroundColor: "#07090F", font: "", textScale: 1, competitionLogoUrl: "" },
};
