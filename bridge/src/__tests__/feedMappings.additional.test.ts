import { applyFeedMapping, FeedMapping } from "../graphics/feedTransform";
import championDataBasketball from "../graphics/feedMappings/championdata.basketball.json";
import championDataCricket from "../graphics/feedMappings/championdata.cricket.json";

// These two mappings are best-guess field paths (no real Champion Data sample
// available for basketball/cricket, unlike netball). These tests only prove
// applyFeedMapping's generic walking logic handles the declared shape
// correctly — they do not verify the field paths match a real feed. Update
// the fixtures here once a live payload is available.

describe("applyFeedMapping — championdata.basketball (best-guess mapping)", () => {
  const mapping = championDataBasketball as FeedMapping;

  function makePlayer(overrides: Record<string, unknown> = {}) {
    return {
      playerId: 501,
      playerName: "A Player",
      playerFirstname: "A",
      playerSurname: "Player",
      position: "G",
      minutesPlayed: 28,
      points: 18,
      fieldGoalsMade: 7,
      fieldGoalsAttempted: 14,
      threePointsMade: 2,
      threePointsAttempted: 5,
      freeThrowsMade: 2,
      freeThrowsAttempted: 2,
      rebounds: 4,
      offensiveRebounds: 1,
      defensiveRebounds: 3,
      assists: 5,
      steals: 2,
      blocks: 0,
      turnovers: 3,
      personalFouls: 2,
      plusMinus: 6,
      ...overrides,
    };
  }

  function makeTeam(overrides: Record<string, unknown> = {}) {
    return {
      squadName: "Breakers",
      points: 88,
      fieldGoalsMade: 33,
      fieldGoalsAttempted: 70,
      fieldGoalPercentage: 47.1,
      threePointsMade: 9,
      threePointsAttempted: 24,
      freeThrowsMade: 13,
      freeThrowsAttempted: 16,
      rebounds: 38,
      offensiveRebounds: 10,
      defensiveRebounds: 28,
      assists: 20,
      steals: 8,
      blocks: 3,
      turnovers: 12,
      personalFouls: 18,
      fastBreakPoints: 14,
      pointsInPaint: 40,
      benchPoints: 22,
      player: [makePlayer()],
      ...overrides,
    };
  }

  function makePayload(home = makeTeam(), visitor = makeTeam({ squadName: "Bullets" })) {
    return { sport: { basketballMatchStats: { team: [home, visitor] } } };
  }

  it("flattens team and player stats per the declared mapping", () => {
    const result = applyFeedMapping(makePayload(), mapping);
    expect(result?.team.home.points).toBe(88);
    expect(result?.team.visitor.squadName).toBe("Bullets");
    expect(result?.players.find(p => p.id === "501")?.stats.points).toBe(18);
  });

  it("returns undefined for a payload that doesn't match the shape", () => {
    expect(applyFeedMapping({ sport: {} }, mapping)).toBeUndefined();
  });
});

describe("applyFeedMapping — championdata.cricket (best-guess mapping)", () => {
  const mapping = championDataCricket as FeedMapping;

  function makePlayer(overrides: Record<string, unknown> = {}) {
    return {
      playerId: 601,
      playerName: "B Batter",
      playerFirstname: "B",
      playerSurname: "Batter",
      battingRuns: 45,
      ballsFaced: 38,
      battingFours: 5,
      battingSixes: 1,
      strikeRate: 118.4,
      bowlingOvers: 0,
      bowlingWickets: 0,
      bowlingRuns: 0,
      economyRate: 0,
      catches: 1,
      ...overrides,
    };
  }

  function makeTeam(overrides: Record<string, unknown> = {}) {
    return {
      squadName: "Blackcaps",
      runs: 178,
      wickets: 6,
      overs: 20,
      runRate: 8.9,
      extras: 9,
      fours: 14,
      sixes: 6,
      player: [makePlayer()],
      ...overrides,
    };
  }

  function makePayload(home = makeTeam(), visitor = makeTeam({ squadName: "Blackjacks" })) {
    return { sport: { cricketMatchStats: { team: [home, visitor] } } };
  }

  it("flattens team and player stats per the declared mapping", () => {
    const result = applyFeedMapping(makePayload(), mapping);
    expect(result?.team.home.runs).toBe(178);
    expect(result?.team.visitor.squadName).toBe("Blackjacks");
    expect(result?.players.find(p => p.id === "601")?.stats.battingRuns).toBe(45);
  });

  it("returns undefined for a payload that doesn't match the shape", () => {
    expect(applyFeedMapping({ sport: {} }, mapping)).toBeUndefined();
  });
});
