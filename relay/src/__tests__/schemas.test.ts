import { matchStatePatchSchema, matchStateSchema } from "../schemas";

const ALL_SPORT_TYPES = [
  "netball", "basketball", "rugby_union", "rugby_league",
  "volleyball", "football", "handball", "hockey", "waterpolo", "tennis",
  "touch_rugby", "futsal", "pickleball", "badminton",
  "table_tennis", "floorball", "squash", "lawn_bowls",
  "indoor_cricket", "softball", "cricket",
  "custom",
] as const;

describe("sportSchema", () => {
  it.each(ALL_SPORT_TYPES)("accepts sport type: %s", (sport) => {
    const result = matchStatePatchSchema.safeParse({ sport });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown sport string", () => {
    const result = matchStatePatchSchema.safeParse({ sport: "underwater_hockey" });
    expect(result.success).toBe(false);
  });
});

describe("sportConfig passthrough", () => {
  it("accepts a sportConfig record on a patch", () => {
    const result = matchStatePatchSchema.safeParse({
      sportConfig: { format: "bo5", wicketPenalty: "5" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sportConfig).toEqual({ format: "bo5", wicketPenalty: "5" });
    }
  });

  it("accepts an empty sportConfig", () => {
    const result = matchStatePatchSchema.safeParse({ sportConfig: {} });
    expect(result.success).toBe(true);
  });
});

describe("sportState passthrough", () => {
  it("accepts a sportState object on a patch", () => {
    const result = matchStatePatchSchema.safeParse({
      sportState: { sport: "softball", format: "fastpitch", inningHalf: "top", outs: 0, balls: 0, strikes: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts nested arbitrary fields inside sportState", () => {
    const result = matchStatePatchSchema.safeParse({
      sportState: { sport: "cricket", innings: [{ battingTeam: "home", runs: 43, wickets: 2 }] },
    });
    expect(result.success).toBe(true);
  });
});

describe("matchStatePatchSchema field validation", () => {
  it("rejects a non-integer score", () => {
    const result = matchStatePatchSchema.safeParse({ home: { score: "five" } });
    expect(result.success).toBe(false);
  });

  it("rejects clockSeconds above 24h", () => {
    const result = matchStatePatchSchema.safeParse({ clockSeconds: 24 * 60 * 60 + 1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid possession value", () => {
    const result = matchStatePatchSchema.safeParse({ possession: "everyone" });
    expect(result.success).toBe(false);
  });
});
