import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import { AddressInfo } from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer } from "../server";
import { DEFAULT_MATCH_STATE, MatchState } from "../types";
import { getCricketState, applyCricketBall, applyOverComplete, applyInningsChange, applyDeclare, isFollowOnEligible } from "../cricket";
import type { CricketBatter, CricketBowler, CricketState } from "@scorehub/types";

function batter(playerId: number, name: string): CricketBatter {
  return { playerId, name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dismissed: false };
}
function bowler(playerId: number, name: string): CricketBowler {
  return { playerId, name, overs: 0, ballsThisOver: 0, maidens: 0, runs: 0, wickets: 0 };
}

function stateWithCricket(cricket: CricketState): MatchState {
  return { ...DEFAULT_MATCH_STATE, sequenceId: 0, sport: "cricket", sportState: cricket } as MatchState;
}

function freshT20State(): MatchState {
  return stateWithCricket({
    sport: "cricket",
    format: "t20",
    inningsNumber: 1,
    innings: [{
      battingTeam: "home", runs: 0, wickets: 0, oversComplete: 0, ballsThisOver: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
      batters: [batter(0, "A"), batter(1, "B"), batter(2, "C")],
      bowlers: [bowler(10, "X")],
      currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0,
      thisOverBalls: [],
    }],
    homeSquad: [{ id: 0, name: "A" }, { id: 1, name: "B" }, { id: 2, name: "C" }],
    visitorSquad: [{ id: 10, name: "X" }],
  });
}

// ─── Pure engine ──────────────────────────────────────────────────────────────

describe("getCricketState", () => {
  it("returns the existing sportState when already cricket", () => {
    const state = freshT20State();
    const cs = getCricketState(state);
    expect(cs.innings[0].batters).toHaveLength(3);
  });

  it("builds a fresh default state when sportState is missing, using sportConfig.format", () => {
    const state = { ...DEFAULT_MATCH_STATE, sport: "cricket", sportConfig: { format: "odi" } } as unknown as MatchState;
    const cs = getCricketState(state);
    expect(cs.format).toBe("odi");
    expect(cs.innings).toHaveLength(1);
    expect(cs.innings[0].runs).toBe(0);
  });
});

describe("applyCricketBall — runs and batter stats", () => {
  it("credits a normal scoring ball to the striker and team total", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 4, isWicket: false });
    const inn = next.innings[0];
    expect(inn.runs).toBe(4);
    expect(inn.batters[0].runs).toBe(4);
    expect(inn.batters[0].ballsFaced).toBe(1);
    expect(inn.batters[0].fours).toBe(1);
    expect(inn.ballsThisOver).toBe(1);
  });

  it("rotates the strike on odd runs", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 1, isWicket: false });
    expect(next.innings[0].currentBatter1Index).toBe(1);
    expect(next.innings[0].currentBatter2Index).toBe(0);
  });

  it("does not rotate strike on even runs", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 2, isWicket: false });
    expect(next.innings[0].currentBatter1Index).toBe(0);
  });
});

describe("applyCricketBall — extras", () => {
  it("a wide adds 1 penalty run + any run to the team total, does not count as a legal ball, and is credited to the bowler", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 1, isWicket: false, isWide: true });
    const inn = next.innings[0];
    expect(inn.runs).toBe(2);
    expect(inn.extras.wides).toBe(2);
    expect(inn.ballsThisOver).toBe(0);
    expect(inn.bowlers[0].runs).toBe(2);
    expect(inn.batters[0].ballsFaced).toBe(0);
  });

  it("a no-ball adds a penalty run, credits runs off the bat to the striker, and does not count as a legal ball", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 4, isWicket: false, isNoBall: true });
    const inn = next.innings[0];
    expect(inn.runs).toBe(5);
    expect(inn.extras.noBalls).toBe(1);
    expect(inn.ballsThisOver).toBe(0);
    expect(inn.batters[0].runs).toBe(4);
    expect(inn.batters[0].fours).toBe(1);
  });

  it("byes count as a legal ball and are not credited to the batter's runs", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 2, isWicket: false, isBye: true });
    const inn = next.innings[0];
    expect(inn.runs).toBe(2);
    expect(inn.extras.byes).toBe(2);
    expect(inn.ballsThisOver).toBe(1);
    expect(inn.batters[0].runs).toBe(0);
    expect(inn.batters[0].ballsFaced).toBe(1);
  });
});

describe("applyCricketBall — wickets", () => {
  it("dismisses the striker, credits the bowler, and applies the supplied next batter", () => {
    const next = applyCricketBall(freshT20State(), {
      battingTeam: "home", runs: 0, isWicket: true, wicketType: "bowled", nextBatterIndex: 2,
    });
    const inn = next.innings[0];
    expect(inn.wickets).toBe(1);
    expect(inn.batters[0].dismissed).toBe(true);
    expect(inn.batters[0].wicketType).toBe("bowled");
    expect(inn.bowlers[0].wickets).toBe(1);
    expect(inn.currentBatter1Index).toBe(2);
  });

  it("does not credit the bowler on a run out", () => {
    const next = applyCricketBall(freshT20State(), {
      battingTeam: "home", runs: 0, isWicket: true, wicketType: "run_out",
    });
    expect(next.innings[0].bowlers[0].wickets).toBe(0);
    expect(next.innings[0].wickets).toBe(1);
  });
});

describe("applyCricketBall — over completion", () => {
  it("completes the over after 6 legal deliveries, resets the ball tally, and swaps ends", () => {
    let state = freshT20State();
    for (let i = 0; i < 6; i++) {
      state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false }));
    }
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.oversComplete).toBe(1);
    expect(inn.ballsThisOver).toBe(0);
    expect(inn.bowlers[0].overs).toBe(1);
    expect(inn.thisOverBalls).toHaveLength(0);
    // 6 dot balls: no mid-over rotation, but ends swap at over completion
    expect(inn.currentBatter1Index).toBe(1);
  });

  it("wides and no-balls do not count towards the 6 legal deliveries", () => {
    let state = freshT20State();
    for (let i = 0; i < 5; i++) {
      state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false }));
    }
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false, isWide: true }));
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.oversComplete).toBe(0);
    expect(inn.ballsThisOver).toBe(5);
  });
});

describe("applyCricketBall — maiden overs", () => {
  it("credits the bowler with a maiden when no runs are conceded from any source over 6 legal balls", () => {
    let state = freshT20State();
    for (let i = 0; i < 6; i++) {
      state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false }));
    }
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.oversComplete).toBe(1);
    expect(inn.bowlers[0].maidens).toBe(1);
    expect(inn.runsConcededThisOver).toBe(0);
  });

  it("does not credit a maiden when any runs (including byes) were conceded in the over", () => {
    let state = freshT20State();
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 1, isWicket: false, isBye: true }));
    for (let i = 0; i < 5; i++) {
      state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false }));
    }
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.oversComplete).toBe(1);
    expect(inn.bowlers[0].maidens).toBe(0);
  });

  it("does not credit a maiden when a wide was bowled in the over, even scoreless otherwise", () => {
    let state = freshT20State();
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false, isWide: true }));
    for (let i = 0; i < 6; i++) {
      state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false }));
    }
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.oversComplete).toBe(1);
    expect(inn.bowlers[0].maidens).toBe(0);
  });
});

describe("applyCricketBall — free hit", () => {
  it("sets freeHit after a no-ball", () => {
    const next = applyCricketBall(freshT20State(), { battingTeam: "home", runs: 0, isWicket: false, isNoBall: true });
    expect(next.innings[0].freeHit).toBe(true);
  });

  it("clears freeHit after the following legal ball", () => {
    let state = freshT20State();
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false, isNoBall: true }));
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 1, isWicket: false }));
    expect((state.sportState as CricketState).innings[0].freeHit).toBe(false);
  });

  it("nullifies a bowled dismissal on a free hit — no wicket, batter not dismissed", () => {
    let state = freshT20State();
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false, isNoBall: true }));
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: true, wicketType: "bowled" }));
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.wickets).toBe(0);
    expect(inn.batters[0].dismissed).toBe(false);
    expect(inn.bowlers[0].wickets).toBe(0);
  });

  it("still allows a run-out dismissal on a free hit", () => {
    let state = freshT20State();
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: false, isNoBall: true }));
    state = stateWithCricket(applyCricketBall(state, { battingTeam: "home", runs: 0, isWicket: true, wicketType: "run_out" }));
    const inn = (state.sportState as CricketState).innings[0];
    expect(inn.wickets).toBe(1);
    expect(inn.batters[0].dismissed).toBe(true);
  });
});

describe("applyOverComplete", () => {
  it("sets the next bowler when supplied", () => {
    const state = freshT20State();
    const cs = getCricketState(state);
    cs.innings[0].bowlers.push(bowler(11, "Y"));
    const next = applyOverComplete(stateWithCricket(cs), { nextBowlerIndex: 1 });
    expect(next.innings[0].currentBowlerIndex).toBe(1);
  });
});

describe("applyInningsChange", () => {
  it("appends a new innings for the other team and sets a target from the first innings total", () => {
    let cs = getCricketState(freshT20State());
    cs = { ...cs, innings: [{ ...cs.innings[0], runs: 150, wickets: 8 }] };
    const next = applyInningsChange(stateWithCricket(cs), { battingTeam: "visitor" });
    expect(next.inningsNumber).toBe(2);
    expect(next.innings).toHaveLength(2);
    expect(next.innings[1].battingTeam).toBe("visitor");
    expect(next.innings[1].target).toBe(151);
  });

  it("uses an explicit target when supplied", () => {
    const cs = getCricketState(freshT20State());
    const next = applyInningsChange(stateWithCricket(cs), { battingTeam: "visitor", target: 200 });
    expect(next.innings[1].target).toBe(200);
  });
});

describe("applyDeclare", () => {
  it("marks the current innings declared when battingTeam matches", () => {
    const cs = getCricketState(freshT20State());
    const next = applyDeclare(stateWithCricket(cs), { battingTeam: "home" });
    expect(next.innings[0].declared).toBe(true);
  });

  it("is a no-op when battingTeam does not match the currently batting side", () => {
    const cs = getCricketState(freshT20State());
    const next = applyDeclare(stateWithCricket(cs), { battingTeam: "visitor" });
    expect(next.innings[0].declared).toBeUndefined();
  });
});

describe("isFollowOnEligible", () => {
  function testStateWith(firstRuns: number, secondRuns: number, secondDeclared = false): CricketState {
    return {
      sport: "cricket", format: "test", inningsNumber: 2,
      innings: [
        { battingTeam: "home", runs: firstRuns, wickets: 10, oversComplete: 90, ballsThisOver: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
          batters: [], bowlers: [], currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0, thisOverBalls: [] },
        { battingTeam: "visitor", runs: secondRuns, wickets: secondDeclared ? 4 : 10, oversComplete: 60, ballsThisOver: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
          batters: [], bowlers: [], currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0, thisOverBalls: [],
          declared: secondDeclared },
      ],
      homeSquad: [], visitorSquad: [],
    };
  }

  it("is true when format is test, the second innings is complete, and the deficit is >= 200", () => {
    expect(isFollowOnEligible(testStateWith(500, 250))).toBe(true);
  });

  it("is false when the deficit is under 200", () => {
    expect(isFollowOnEligible(testStateWith(400, 250))).toBe(false);
  });

  it("is false for non-test formats", () => {
    const cs = { ...testStateWith(500, 250), format: "odi" as const };
    expect(isFollowOnEligible(cs)).toBe(false);
  });
});

// ─── Socket integration ───────────────────────────────────────────────────────

const BRIDGE_SECRET  = "test-bridge-secret-cricket";
const CONTROL_SECRET = "test-control-secret-cricket";

let app: ReturnType<typeof createServer>["app"];
let httpServer: ReturnType<typeof createServer>["httpServer"];
let closeServer: ReturnType<typeof createServer>["close"];
let serverUrl: string;
let uploadDir: string;

beforeAll(done => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-cricket-test-"));
  ({ app, httpServer, close: closeServer } = createServer({
    bridgeSecret: BRIDGE_SECRET,
    controlSecret: CONTROL_SECRET,
    uploadDir,
    controlRateLimit: 1000,
    allowedOrigins: ["http://localhost:3000"],
  }));
  httpServer.listen(0, () => {
    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll(done => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  closeServer(done);
});

function nextEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>(resolve => socket.once(event, resolve));
}

async function connectControl(): Promise<Socket> {
  const socket = ioClient(serverUrl, { auth: { secret: CONTROL_SECRET, role: "control" }, reconnection: false });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect_error", reject);
    socket.on("controllerGranted", resolve);
    socket.on("controllerConflict", () => socket.emit("takeControl"));
  });
  return socket;
}

function connectViewer(): Promise<Socket> {
  const socket = ioClient(serverUrl, { reconnection: false });
  return new Promise((resolve, reject) => {
    socket.once("matchStateChange", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

describe("socket — cricket:ball", () => {
  it("applies a ball and broadcasts the updated sportState to viewers", async () => {
    await request(app).post("/manual").set("x-control-secret", CONTROL_SECRET).send({
      sport: "cricket",
      sportState: {
        sport: "cricket", format: "t20", inningsNumber: 1,
        innings: [{
          battingTeam: "home", runs: 0, wickets: 0, oversComplete: 0, ballsThisOver: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
          batters: [{ playerId: 0, name: "A", runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dismissed: false }],
          bowlers: [{ playerId: 10, name: "X", overs: 0, ballsThisOver: 0, maidens: 0, runs: 0, wickets: 0 }],
          currentBatter1Index: 0, currentBatter2Index: 0, currentBowlerIndex: 0, thisOverBalls: [],
        }],
        homeSquad: [], visitorSquad: [],
      },
    });

    const control = await connectControl();
    const viewer = await connectViewer();
    try {
      const broadcastPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("cricket:ball", { battingTeam: "home", runs: 4, isWicket: false });
      const received = await broadcastPromise;
      const cs = received.sportState as CricketState;
      expect(cs.innings[0].runs).toBe(4);
      expect(cs.innings[0].batters[0].runs).toBe(4);
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });

  it("rejects a malformed cricket:ball payload without broadcasting (SA-5)", async () => {
    const control = await connectControl();
    const viewer = await connectViewer();
    try {
      let broadcast = false;
      viewer.once("matchStateChange", () => { broadcast = true; });
      control.emit("cricket:ball", { battingTeam: "home", runs: 99, isWicket: false });
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(broadcast).toBe(false);
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });
});

describe("socket — cricket:declare and cricket:inningsChange", () => {
  it("declares the current innings and then starts the next one for the other team", async () => {
    await request(app).post("/manual").set("x-control-secret", CONTROL_SECRET).send({
      sport: "cricket",
      sportState: {
        sport: "cricket", format: "test", inningsNumber: 1,
        innings: [{
          battingTeam: "home", runs: 300, wickets: 4, oversComplete: 80, ballsThisOver: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
          batters: [], bowlers: [], currentBatter1Index: 0, currentBatter2Index: 1, currentBowlerIndex: 0, thisOverBalls: [],
        }],
        homeSquad: [], visitorSquad: [],
      },
    });

    const control = await connectControl();
    const viewer = await connectViewer();
    try {
      const declarePromise = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("cricket:declare", { battingTeam: "home" });
      const declared = await declarePromise;
      expect((declared.sportState as CricketState).innings[0].declared).toBe(true);

      const inningsPromise = nextEvent<MatchState>(viewer, "matchStateChange");
      control.emit("cricket:inningsChange", { battingTeam: "visitor" });
      const nextInnings = await inningsPromise;
      const cs = nextInnings.sportState as CricketState;
      expect(cs.inningsNumber).toBe(2);
      expect(cs.innings[1].battingTeam).toBe("visitor");
      expect(cs.innings[1].target).toBe(301);
    } finally {
      control.disconnect();
      viewer.disconnect();
    }
  });
});
