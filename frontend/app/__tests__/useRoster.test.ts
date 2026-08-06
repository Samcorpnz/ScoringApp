import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { findRosterMatch, useRoster, RosterPlayer } from "../hooks/useRoster";

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

describe("useRoster", () => {
  it("fetches with a stable, order-independent ids key (deduped sort)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ players: [makePlayer()] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRoster("org-1", ["ext-2", "ext-1"]));

    await waitFor(() => expect(result.current).toHaveLength(1));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("ext-1,ext-2"));

    vi.unstubAllGlobals();
  });
});
