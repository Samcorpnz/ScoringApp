import { z } from "zod";

// Bounds for client-supplied MatchState patches (POST /manual, manualUpdate,
// stateUpdate). These exist purely to reject obviously-malformed/abusive
// input before it's merged into persisted state — not to model every valid
// gameplay value, so ranges are generous (SA-5).
const MAX_NAME_LEN = 100;
const MAX_PLAYERS = 50;

const teamPlayerSchema = z.object({
  number: z.number().int().min(0).max(999),
  name: z.string().max(MAX_NAME_LEN),
  onCourt: z.boolean(),
  faults: z.number().int().min(0).max(9999),
  points: z.number().int().min(0).max(9999),
});

const teamStateSchema = z.object({
  name: z.string().max(MAX_NAME_LEN),
  score: z.number().int().min(0).max(9999),
  faults: z.number().int().min(0).max(9999),
  timeouts: z.number().int().min(0).max(99),
  players: z.array(teamPlayerSchema).max(MAX_PLAYERS),
  color: z.string().max(20),
  logoUrl: z.string().max(2000),
}).partial();

const displayThemeSchema = z.object({
  primaryColor: z.string().max(20),
  backgroundColor: z.string().max(20),
  font: z.string().max(100),
  textScale: z.number().min(0.1).max(10),
  competitionLogoUrl: z.string().max(2000),
}).partial();

const possessionSchema = z.enum(["home", "visitor", "both", "none"]);

const sportSchema = z.enum([
  "netball", "basketball", "rugby_union", "rugby_league",
  "volleyball", "football", "handball", "hockey", "waterpolo", "tennis",
  "touch_rugby", "futsal", "pickleball", "badminton",
  "table_tennis", "floorball", "squash", "lawn_bowls",
  "indoor_cricket", "softball", "cricket",
  "custom",
]);

// .passthrough() on netballStats: it's a large, rarely-hand-edited nested
// stats blob sourced from the bridge's own validated ChampionData parser
// (SA-6) — bounding every field here would just duplicate that schema.
const matchStateFields = {
  sequenceId: z.number().int().min(0),
  clockSeconds: z.number().int().min(-1).max(24 * 60 * 60),
  countDown: z.boolean(),
  period: z.string().max(20),
  periodBreak: z.boolean(),
  matchName: z.string().max(MAX_NAME_LEN),
  isRunning: z.boolean(),
  possession: possessionSchema,
  hornActive: z.boolean(),
  sport: sportSchema,
  inputSource: z.string().max(50),
  home: teamStateSchema,
  visitor: teamStateSchema,
  netballStats: z.object({}).passthrough().optional(),
  sportState: z.object({}).passthrough().optional(),
  sportConfig: z.record(z.string(), z.unknown()).optional(),
  displayTheme: displayThemeSchema,
};

// Full state, required on every field — used for the bridge's stateUpdate
// event, which always sends the complete MatchState.
export const matchStateSchema = z.object(matchStateFields);

// Partial state — used for /manual and manualUpdate, which send only the
// fields being changed.
export const matchStatePatchSchema = z.object(matchStateFields).partial();

export type MatchStatePatch = z.infer<typeof matchStatePatchSchema>;

// Payload schemas for the dedicated cricket:* socket events. Unlike
// indoor_cricket/softball (whole sportState pushed through the generic,
// passthrough-validated manualUpdate patch), cricket's ball-by-ball state
// machine runs server-side, so its wire payloads get real validation.
const wicketTypeSchema = z.enum([
  "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket", "obstructed_field", "handled_ball",
]);

const battingTeamSchema = z.enum(["home", "visitor"]);

export const cricketBallEventSchema = z.object({
  battingTeam: battingTeamSchema,
  runs: z.number().int().min(0).max(6),
  isWicket: z.boolean(),
  wicketType: wicketTypeSchema.optional(),
  isWide: z.boolean().optional(),
  isNoBall: z.boolean().optional(),
  isBye: z.boolean().optional(),
  isLegBye: z.boolean().optional(),
  nextBatterIndex: z.number().int().min(0).max(10).optional(),
});

export const cricketOverCompleteEventSchema = z.object({
  nextBowlerIndex: z.number().int().min(0).max(10).optional(),
});

export const cricketInningsChangeEventSchema = z.object({
  battingTeam: battingTeamSchema,
  target: z.number().int().min(0).max(9999).optional(),
});

export const cricketDeclareEventSchema = z.object({
  battingTeam: battingTeamSchema,
});

export type CricketBallEventPayload = z.infer<typeof cricketBallEventSchema>;
export type CricketOverCompleteEventPayload = z.infer<typeof cricketOverCompleteEventSchema>;
export type CricketInningsChangeEventPayload = z.infer<typeof cricketInningsChangeEventSchema>;
export type CricketDeclareEventPayload = z.infer<typeof cricketDeclareEventSchema>;
