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
  "volleyball", "football", "handball", "hockey", "waterpolo", "tennis", "custom",
]);

// .passthrough() on netballStats: it's a large, rarely-hand-edited nested
// stats blob sourced from the bridge's own validated ChampionData parser
// (SA-6) — bounding every field here would just duplicate that schema.
const matchStateFields = {
  sequenceId: z.number().int().min(0),
  clockSeconds: z.number().int().min(-1).max(24 * 60 * 60),
  countDown: z.boolean(),
  period: z.string().max(20),
  matchName: z.string().max(MAX_NAME_LEN),
  isRunning: z.boolean(),
  possession: possessionSchema,
  hornActive: z.boolean(),
  sport: sportSchema,
  inputSource: z.string().max(50),
  home: teamStateSchema,
  visitor: teamStateSchema,
  netballStats: z.object({}).passthrough().optional(),
  displayTheme: displayThemeSchema,
};

// Full state, required on every field — used for the bridge's stateUpdate
// event, which always sends the complete MatchState.
export const matchStateSchema = z.object(matchStateFields);

// Partial state — used for /manual and manualUpdate, which send only the
// fields being changed.
export const matchStatePatchSchema = z.object(matchStateFields).partial();

export type MatchStatePatch = z.infer<typeof matchStatePatchSchema>;
