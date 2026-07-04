import { describe, it, expect } from "vitest";
import { findRosterMatch, RosterPlayer } from "../hooks/useRoster";

function makePlayer(overrides: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    externalId: "ext-1",
    provider: "championdata",
    firstName: "Jane",
    lastName: "Doe",
    displayName: null,
    photoUrl: null,
    bio: null,
    ...overrides,
  };
}

describe("findRosterMatch", () => {
  it("matches a roster player by externalId", () => {
    const roster = [makePlayer({ externalId: "ext-1" }), makePlayer({ externalId: "ext-2" })];
    expect(findRosterMatch(roster, "ext-1")?.externalId).toBe("ext-1");
  });

  it("returns undefined when no feed player id is given", () => {
    const roster = [makePlayer()];
    expect(findRosterMatch(roster, undefined)).toBeUndefined();
  });

  it("returns undefined when nothing matches", () => {
    const roster = [makePlayer({ externalId: "ext-1" })];
    expect(findRosterMatch(roster, "ext-99")).toBeUndefined();
  });
});
