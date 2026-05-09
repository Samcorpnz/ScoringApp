import type { SportType, Possession } from "./types";

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
  },
];

export function getTemplate(sport: SportType): SportTemplate {
  return SPORT_TEMPLATES.find(t => t.sport === sport) ?? SPORT_TEMPLATES[SPORT_TEMPLATES.length - 1];
}
