import { EventEmitter } from "events";
import { Socket } from "socket.io-client";
import { startPushSource } from "../sources/mockPushSource";
import { DEFAULT_MATCH_STATE, MatchState } from "../types";

// Proves the multi-provider registry works end-to-end with a transport that
// isn't HTTP polling (championDataJsonSource.ts) — here, an EventEmitter
// standing in for a websocket "message" event — and a payload shape unrelated
// to Champion Data's, via mockpush.netball.json.

function makeSocket(connected = true): Socket {
  return { connected, emit: jest.fn() } as unknown as Socket;
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    match: {
      teams: [
        { name: "Home Squad", stats: { goals: 40, attempts: 48, turnovers: 6 }, roster: [
          { id: "p1", name: "A Player", position: "GS", stats: { goals: 30, assists: 2, intercepts: 1 } },
        ] },
        { name: "Away Squad", stats: { goals: 35, attempts: 44, turnovers: 9 }, roster: [] },
      ],
    },
    ...overrides,
  };
}

describe("startPushSource", () => {
  it("builds a graphicsFeed from a pushed payload via the mockpush mapping", () => {
    const socket = makeSocket();
    let state: MatchState = { ...DEFAULT_MATCH_STATE, sport: "netball" };
    const feed = new EventEmitter();

    const stop = startPushSource(socket, () => state, s => { state = s; }, feed);
    feed.emit("message", makePayload());

    expect(state.graphicsFeed?.provider).toBe("mockpush");
    expect(state.graphicsFeed?.stats.team.home.goals).toBe(40);
    expect(state.graphicsFeed?.stats.players.find(p => p.id === "p1")?.stats.goals).toBe(30);
    expect(socket.emit).toHaveBeenCalledWith("stateUpdate", expect.objectContaining({ graphicsFeed: state.graphicsFeed }));

    stop();
  });

  it("stops listening once the returned teardown is called", () => {
    const socket = makeSocket();
    let state: MatchState = { ...DEFAULT_MATCH_STATE, sport: "netball" };
    const feed = new EventEmitter();

    const stop = startPushSource(socket, () => state, s => { state = s; }, feed);
    stop();
    feed.emit("message", makePayload());

    expect(state.graphicsFeed).toBeUndefined();
  });

  it("never throws on a malformed payload and leaves graphicsFeed unset", () => {
    const socket = makeSocket();
    let state: MatchState = { ...DEFAULT_MATCH_STATE, sport: "netball" };
    const feed = new EventEmitter();

    startPushSource(socket, () => state, s => { state = s; }, feed);
    expect(() => feed.emit("message", { garbage: true })).not.toThrow();
    expect(state.graphicsFeed).toBeUndefined();
  });

  it("no-ops for a sport with no registered mockpush mapping", () => {
    const socket = makeSocket();
    let state: MatchState = { ...DEFAULT_MATCH_STATE, sport: "basketball" };
    const feed = new EventEmitter();

    startPushSource(socket, () => state, s => { state = s; }, feed);
    feed.emit("message", makePayload());

    expect(state.graphicsFeed).toBeUndefined();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
