import {
  matchStatePatchSchema, manualUpdateRequestSchema,
  cricketBallEventSchema, cricketOverCompleteEventSchema, cricketInningsChangeEventSchema, cricketDeclareEventSchema,
} from "../schemas";

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

describe("cricket event schemas", () => {
  it("accepts a normal ball", () => {
    const result = cricketBallEventSchema.safeParse({ battingTeam: "home", runs: 4, isWicket: false });
    expect(result.success).toBe(true);
  });

  it("accepts a wicket ball with wicketType and nextBatterIndex", () => {
    const result = cricketBallEventSchema.safeParse({
      battingTeam: "home", runs: 0, isWicket: true, wicketType: "bowled", nextBatterIndex: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects runs above 6", () => {
    const result = cricketBallEventSchema.safeParse({ battingTeam: "home", runs: 7, isWicket: false });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown wicketType", () => {
    const result = cricketBallEventSchema.safeParse({ battingTeam: "home", runs: 0, isWicket: true, wicketType: "caught_behind" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing battingTeam", () => {
    const result = cricketBallEventSchema.safeParse({ runs: 1, isWicket: false });
    expect(result.success).toBe(false);
  });

  it("cricketOverCompleteEventSchema accepts an empty object and a nextBowlerIndex", () => {
    expect(cricketOverCompleteEventSchema.safeParse({}).success).toBe(true);
    expect(cricketOverCompleteEventSchema.safeParse({ nextBowlerIndex: 2 }).success).toBe(true);
  });

  it("cricketInningsChangeEventSchema requires battingTeam and accepts an optional target", () => {
    expect(cricketInningsChangeEventSchema.safeParse({ battingTeam: "visitor" }).success).toBe(true);
    expect(cricketInningsChangeEventSchema.safeParse({ battingTeam: "visitor", target: 180 }).success).toBe(true);
    expect(cricketInningsChangeEventSchema.safeParse({}).success).toBe(false);
  });

  it("cricketDeclareEventSchema requires battingTeam", () => {
    expect(cricketDeclareEventSchema.safeParse({ battingTeam: "home" }).success).toBe(true);
    expect(cricketDeclareEventSchema.safeParse({}).success).toBe(false);
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

  it("accepts clockAnchorMs/clockCarryMs present", () => {
    const result = matchStatePatchSchema.safeParse({ clockAnchorMs: Date.now(), clockCarryMs: 700 });
    expect(result.success).toBe(true);
  });

  it("accepts clockAnchorMs/clockCarryMs absent (optional, backward compatible)", () => {
    const result = matchStatePatchSchema.safeParse({ clockSeconds: 30 });
    expect(result.success).toBe(true);
  });

  it("rejects a wildly out-of-range clockCarryMs", () => {
    const result = matchStatePatchSchema.safeParse({ clockCarryMs: 5000 });
    expect(result.success).toBe(false);
  });
});

describe("manualUpdateRequestSchema", () => {
  it("accepts a patch with clientEventMs", () => {
    const result = manualUpdateRequestSchema.safeParse({ isRunning: true, clientEventMs: Date.now() });
    expect(result.success).toBe(true);
  });

  it("accepts a patch without clientEventMs", () => {
    const result = manualUpdateRequestSchema.safeParse({ isRunning: true });
    expect(result.success).toBe(true);
  });

  it("rejects a non-numeric clientEventMs", () => {
    const result = manualUpdateRequestSchema.safeParse({ isRunning: true, clientEventMs: "now" });
    expect(result.success).toBe(false);
  });
});
