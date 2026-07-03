import type { ComponentType } from "react";
import type { SportType, Possession, MatchState } from "./types";

export interface ControlPanelProps {
  state: MatchState;
  push: (p: Partial<MatchState>) => void;
  sendReset: () => void;
  sendUndo: () => void;
}

export interface ConfigFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "select";
  options: ConfigFieldOption[];
  defaultValue: string;
}

export interface SportTemplate {
  sport: SportType;
  label: string;
  structure: string;
  periods: number;
  periodLabel: string;
  clockSeconds: number;
  countDown: boolean;
  timeoutsPerTeam: number;
  defaultPossession: Possession;
  scoreIncrements: number[];
  scoreLabels?: string[];
  resetScoreOnPeriod?: boolean;
  controlPanel?: ComponentType<ControlPanelProps>;
  matchConfig?: ConfigField[];
}

export const SPORT_TEMPLATES: SportTemplate[] = [
  {
    sport: "netball",
    label: "Netball",
    structure: "4 quarters × 15:00",
    periods: 4,
    periodLabel: "QTR",
    clockSeconds: 900,
    countDown: true,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1, 2],
  },
  {
    sport: "basketball",
    label: "Basketball",
    structure: "4 quarters × 10:00",
    periods: 4,
    periodLabel: "QTR",
    clockSeconds: 600,
    countDown: true,
    timeoutsPerTeam: 5,
    defaultPossession: "home",
    scoreIncrements: [1, 2, 3],
    scoreLabels: ["FT", "2PT", "3PT"],
  },
  {
    sport: "rugby_union",
    label: "Rugby Union",
    structure: "2 halves × 40:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "home",
    scoreIncrements: [3, 5, 7],
    scoreLabels: ["PEN/DG", "TRY", "CONV TRY"],
  },
  {
    sport: "rugby_league",
    label: "Rugby League",
    structure: "2 halves × 40:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "home",
    scoreIncrements: [2, 4, 6],
    scoreLabels: ["CONV/PEN", "TRY", "CONV TRY"],
  },
  {
    sport: "volleyball",
    label: "Volleyball",
    structure: "Best of 5 sets",
    periods: 5,
    periodLabel: "SET",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 2,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
  },
  {
    sport: "football",
    label: "Football",
    structure: "2 halves × 45:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1],
  },
  {
    sport: "handball",
    label: "Handball",
    structure: "2 halves × 30:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 1800,
    countDown: true,
    timeoutsPerTeam: 3,
    defaultPossession: "none",
    scoreIncrements: [1],
  },
  {
    sport: "hockey",
    label: "Hockey",
    structure: "4 quarters × 15:00",
    periods: 4,
    periodLabel: "QTR",
    clockSeconds: 900,
    countDown: true,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1],
  },
  {
    sport: "waterpolo",
    label: "Water Polo",
    structure: "4 quarters × 8:00",
    periods: 4,
    periodLabel: "QTR",
    clockSeconds: 480,
    countDown: true,
    timeoutsPerTeam: 2,
    defaultPossession: "home",
    scoreIncrements: [1],
  },
  {
    sport: "tennis",
    label: "Tennis",
    structure: "Best of 3 or 5 sets",
    periods: 5,
    periodLabel: "SET",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
  },
  {
    sport: "touch_rugby",
    label: "Touch Rugby",
    structure: "2 halves × 40:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 2400,
    countDown: true,
    timeoutsPerTeam: 0,
    defaultPossession: "home",
    scoreIncrements: [1],
  },
  {
    sport: "futsal",
    label: "Futsal",
    structure: "2 halves × 20:00",
    periods: 2,
    periodLabel: "HALF",
    clockSeconds: 1200,
    countDown: true,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1],
  },
  {
    sport: "pickleball",
    label: "Pickleball",
    structure: "Best of 3 games to 11",
    periods: 3,
    periodLabel: "GAME",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 2,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
  },
  {
    sport: "badminton",
    label: "Badminton",
    structure: "Best of 3 games to 21",
    periods: 3,
    periodLabel: "GAME",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
  },
  {
    sport: "table_tennis",
    label: "Table Tennis",
    structure: "Best of 7 games to 11",
    periods: 7,
    periodLabel: "GAME",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
  },
  {
    sport: "floorball",
    label: "Floorball",
    structure: "3 periods × 20:00",
    periods: 3,
    periodLabel: "PERIOD",
    clockSeconds: 1200,
    countDown: true,
    timeoutsPerTeam: 1,
    defaultPossession: "none",
    scoreIncrements: [1],
  },
  {
    sport: "squash",
    label: "Squash",
    structure: "Best of 5 games to 11",
    periods: 5,
    periodLabel: "GAME",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1],
    resetScoreOnPeriod: true,
    matchConfig: [
      {
        key: "format",
        label: "Match Format",
        type: "select",
        options: [
          { value: "bo5", label: "Best of 5", description: "WSF / PSA major events" },
          { value: "bo3", label: "Best of 3", description: "Circuit / club events" },
        ],
        defaultValue: "bo5",
      },
    ],
  },
  {
    sport: "lawn_bowls",
    label: "Lawn Bowls",
    structure: "21 ends",
    periods: 21,
    periodLabel: "END",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1, 2, 3, 4],
  },
  {
    sport: "indoor_cricket",
    label: "Indoor Cricket",
    structure: "2 × 8-over innings",
    periods: 2,
    periodLabel: "INNINGS",
    clockSeconds: 0,
    countDown: false,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1, 2, 4, 6],
    matchConfig: [
      {
        key: "wicketPenalty",
        label: "Wicket Penalty",
        type: "select",
        options: [
          { value: "5", label: "-5 runs", description: "Cricket NZ standard" },
          { value: "2", label: "-2 runs", description: "ICF international" },
        ],
        defaultValue: "5",
      },
    ],
  },
  {
    sport: "custom",
    label: "Custom",
    structure: "2 periods × 10:00",
    periods: 2,
    periodLabel: "PERIOD",
    clockSeconds: 600,
    countDown: true,
    timeoutsPerTeam: 0,
    defaultPossession: "none",
    scoreIncrements: [1, 2, 3],
  },
];

export function getTemplate(sport: SportType): SportTemplate {
  return SPORT_TEMPLATES.find(t => t.sport === sport) ?? SPORT_TEMPLATES[SPORT_TEMPLATES.length - 1];
}
