import { applyFeedMapping, buildGraphicsFeed, FeedMapping } from "../graphics/feedTransform";
import championDataNetball from "../graphics/feedMappings/championdata.netball.json";

const netballMapping = championDataNetball as FeedMapping;

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 80710,
    playerName: "Maia Wilson",
    playerFirstname: "Maia",
    playerSurname: "Wilson",
    currentPosition: "GS",
    startingPositionCode: "GS",
    goals: 29,
    goalAttempts: 31,
    goalMisses: 2,
    shootingPercentage: 93.5,
    goalAssists: 2,
    feeds: 2,
    centrePassReceives: 0,
    secondPhaseReceives: 1,
    penalties: 1,
    intercepts: 0,
    deflections: 2,
    pickups: 0,
    rebounds: 1,
    turnovers: 3,
    gain: 1,
    blocks: 0,
    points: 29,
    ...overrides,
  };
}

function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    squadId: 805,
    squadName: "Mystics",
    goals: 56,
    goalAttempts: 60,
    shootingPercentage: 93.3,
    goalsFromCentrePass: 39,
    goalsFromTurnovers: 5,
    goalsFromGains: 12,
    feeds: 90,
    centrePassReceives: 48,
    secondPhaseReceives: 46,
    penalties: 60,
    turnovers: 20,
    gain: 18,
    rebounds: 4,
    offensiveRebounds: 1,
    defensiveRebounds: 3,
    intercepts: 9,
    deflections: 15,
    pickups: 17,
    blocks: 2,
    timeInPossession: 1894,
    player: [makePlayer()],
    ...overrides,
  };
}

function makePayload(home = makeTeam(), visitor = makeTeam({ squadId: 808, squadName: "Steel" })) {
  return {
    sport: {
      venueName: "The Trusts Arena",
      netballMatchStats: {
        matchId: 1,
        matchStatus: "inProgress",
        period: 4,
        periodCompleted: 3,
        roundNumber: 2,
        homeSquadId: home.squadId,
        awaySquadId: visitor.squadId,
        homeSquadName: home.squadName,
        awaySquadName: visitor.squadName,
        periodSeconds: 900,
        team: [home, visitor],
      },
    },
  };
}

describe("applyFeedMapping — championdata.netball", () => {
  it("flattens team and player stats per the declared mapping", () => {
    const result = applyFeedMapping(makePayload(), netballMapping);
    expect(result).toBeDefined();
    expect(result?.team.home.goals).toBe(56);
    expect(result?.team.home.squadName).toBe("Mystics");
    expect(result?.team.visitor.squadName).toBe("Steel");
    expect(result?.players).toHaveLength(2);

    const wilson = result?.players.find(p => p.id === "80710");
    expect(wilson?.name).toBe("Maia Wilson");
    expect(wilson?.team).toBe("home");
    expect(wilson?.stats.goals).toBe(29);
    expect(wilson?.stats.firstName).toBe("Maia");
  });

  it("returns undefined when the payload doesn't match teamsPath at all", () => {
    const result = applyFeedMapping({ sport: {} }, netballMapping);
    expect(result).toBeUndefined();
  });

  it("returns undefined for completely unrelated JSON", () => {
    expect(applyFeedMapping(null, netballMapping)).toBeUndefined();
    expect(applyFeedMapping("not an object", netballMapping)).toBeUndefined();
    expect(applyFeedMapping({ foo: "bar" }, netballMapping)).toBeUndefined();
  });

  it("degrades a single stat to missing rather than throwing when a field is renamed/missing", () => {
    const home = makeTeam();
    delete (home as Record<string, unknown>).goals;
    const result = applyFeedMapping(makePayload(home), netballMapping);
    expect(result).toBeDefined();
    expect(result?.team.home.goals).toBeUndefined();
    // Other fields on the same team are unaffected.
    expect(result?.team.home.squadName).toBe("Mystics");
  });

  it("drops a player missing a valid id rather than throwing", () => {
    const home = makeTeam({ player: [makePlayer(), makePlayer({ playerId: undefined })] });
    const result = applyFeedMapping(makePayload(home), netballMapping);
    expect(result?.players.filter(p => p.team === "home")).toHaveLength(1);
  });

  it("never throws on a malformed mapping referencing paths that don't exist", () => {
    const badMapping: FeedMapping = {
      ...netballMapping,
      teamFields: [{ path: "does.not.exist.at.all", statKey: "ghost" }],
      playerFields: [{ path: "also.missing", statKey: "ghost" }],
    };
    expect(() => applyFeedMapping(makePayload(), badMapping)).not.toThrow();
    const result = applyFeedMapping(makePayload(), badMapping);
    expect(result?.team.home.ghost).toBeUndefined();
  });
});

describe("buildGraphicsFeed", () => {
  it("wraps the stat bag in a versioned envelope, incrementing from previousVersion", () => {
    const feed = buildGraphicsFeed(makePayload(), netballMapping, 3);
    expect(feed?.provider).toBe("championdata");
    expect(feed?.sport).toBe("netball");
    expect(feed?.version).toBe(4);
    expect(feed?.stats.team.home.goals).toBe(56);
    expect(typeof feed?.capturedAt).toBe("string");
  });

  it("returns undefined (not a stale feed) when the payload doesn't match", () => {
    expect(buildGraphicsFeed({ unrelated: true }, netballMapping, 3)).toBeUndefined();
  });
});
