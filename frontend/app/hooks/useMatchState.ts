"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MatchState, DEFAULT_MATCH_STATE, CricketBallEvent } from "../types";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

// If a hardware input source is configured, the bridge should be pushing
// state updates continuously — no update within this window means the
// bridge's socket is up but its hardware feed has gone quiet (SA-67).
const FEED_STALE_MS = 8_000;
const FEED_STALE_CHECK_MS = 1_000;

// SA-56's failover SLA targets a sub-5s reconnect. A disconnect lasting much
// longer than that is no longer "mid-failover" — it's worth telling the
// operator explicitly rather than just showing the generic OFFLINE dot.
const RELAY_UNREACHABLE_MS = 10_000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
export type ControllerStatus = "connecting" | "granted" | "conflict" | "revoked" | "viewer";

// How long to wait for the relay to resolve a requestControl before retrying
// — the grant/conflict decision is a single fire-and-forget emit server-side
// (relay/src/server.ts), so a lost packet or a race with another socket's
// disconnect cleanup on the same room can otherwise leave the client stuck
// with neither controllerGranted nor controllerConflict, indefinitely.
const CONTROL_REQUEST_RETRY_DELAYS_MS = [1_500, 3_000, 6_000];

export function useMatchState(auth?: { secret: string; role: string }) {
  const [state, setState] = useState<MatchState>({ ...DEFAULT_MATCH_STATE });
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [feedStale, setFeedStale] = useState(false);
  const [relayUnreachable, setRelayUnreachable] = useState(false);
  const [controllerStatus, setControllerStatus] = useState<ControllerStatus>(
    auth?.role === "control" ? "connecting" : "viewer"
  );
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const disconnectedSinceRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const controllerStatusRef = useRef(controllerStatus);
  controllerStatusRef.current = controllerStatus;
  const secret = auth?.secret;
  const role = auth?.role;

  useEffect(() => {
    // Viewers/displays have no secret — scope them to an org via the page's
    // ?org= query param so multiple tenants on one relay stay isolated.
    // An optional &matchId= further scopes them to one specific match
    // instead of the org's singleton "default" match.
    const params = secret === undefined && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : undefined;
    const orgId = params?.get("org") ?? undefined;
    const matchId = params?.get("matchId") ?? undefined;

    const socket = io(RELAY_URL, {
      auth: secret !== undefined ? { secret, role } : orgId ? { orgId, matchId } : {},
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
    socketRef.current = socket;

    const controlRetryTimers: ReturnType<typeof setTimeout>[] = [];
    const clearControlRetries = () => {
      controlRetryTimers.forEach(clearTimeout);
      controlRetryTimers.length = 0;
    };

    socket.on("connect", () => {
      setStatus("connected");
      lastUpdateRef.current = Date.now();
      setFeedStale(false);
      disconnectedSinceRef.current = null;
      setRelayUnreachable(false);

      if (role === "control") {
        setControllerStatus("connecting");
        clearControlRetries();
        const requestControl = () => {
          socket.timeout(3000).emit("requestControl", () => {
            // Ack received — resolveController on the relay has already
            // emitted controllerGranted/controllerConflict by this point.
          });
        };
        requestControl();
        CONTROL_REQUEST_RETRY_DELAYS_MS.forEach(delay => {
          controlRetryTimers.push(setTimeout(() => {
            if (controllerStatusRef.current !== "connecting") return;
            requestControl();
          }, delay));
        });
      }
    });
    socket.on("disconnect", () => {
      setStatus("disconnected");
      setFeedStale(false);
      disconnectedSinceRef.current ??= Date.now();
    });
    socket.on("connect_error", () => {
      setStatus("disconnected");
      setFeedStale(false);
      disconnectedSinceRef.current ??= Date.now();
    });

    socket.on("matchStateChange", (incoming: MatchState) => {
      lastUpdateRef.current = Date.now();
      setFeedStale(false);
      setState(prev =>
        incoming.sequenceId >= prev.sequenceId ? incoming : prev
      );
    });

    socket.on("controllerGranted", () => { clearControlRetries(); setControllerStatus("granted"); });
    socket.on("controllerConflict", () => { clearControlRetries(); setControllerStatus("conflict"); });
    socket.on("controllerRevoked",  () => setControllerStatus("revoked"));

    return () => { clearControlRetries(); socket.disconnect(); };
  }, [secret, role]);

  useEffect(() => {
    const interval = setInterval(() => {
      const shouldBeStale =
        status === "connected" &&
        stateRef.current.inputSource !== "none" &&
        Date.now() - lastUpdateRef.current >= FEED_STALE_MS;
      setFeedStale(shouldBeStale);

      const shouldBeUnreachable =
        status === "disconnected" &&
        disconnectedSinceRef.current !== null &&
        Date.now() - disconnectedSinceRef.current >= RELAY_UNREACHABLE_MS;
      setRelayUnreachable(shouldBeUnreachable);
    }, FEED_STALE_CHECK_MS);
    return () => clearInterval(interval);
  }, [status]);

  // Resolves once the relay has actually applied the patch (or after a
  // timeout/error) — callers that navigate right after sending an update
  // (e.g. the /setup wizard routing into /control) must await this, or the
  // navigation can unmount this hook and disconnect the socket before the
  // fire-and-forget emit ever reaches the relay, silently dropping the patch.
  const sendManualUpdate = (patch: Partial<MatchState>): Promise<void> => {
    return new Promise(resolve => {
      const socket = socketRef.current;
      if (!socket) { resolve(); return; }
      socket.timeout(3000).emit("manualUpdate", patch, () => resolve());
    });
  };

  const sendReset = () => {
    socketRef.current?.emit("resetMatch");
  };

  const sendUndo = () => {
    socketRef.current?.emit("undo");
  };

  const takeControl = () => {
    socketRef.current?.emit("takeControl");
  };

  const sendCricketBall = (payload: CricketBallEvent) => {
    socketRef.current?.emit("cricket:ball", payload);
  };

  const sendCricketOverComplete = (payload: { nextBowlerIndex?: number }) => {
    socketRef.current?.emit("cricket:overComplete", payload);
  };

  const sendCricketInningsChange = (payload: { battingTeam: "home" | "visitor"; target?: number }) => {
    socketRef.current?.emit("cricket:inningsChange", payload);
  };

  const sendCricketDeclare = (payload: { battingTeam: "home" | "visitor" }) => {
    socketRef.current?.emit("cricket:declare", payload);
  };

  return {
    state, status, feedStale, relayUnreachable, sendManualUpdate, sendReset, sendUndo, controllerStatus, takeControl,
    sendCricketBall, sendCricketOverComplete, sendCricketInningsChange, sendCricketDeclare,
  };
}
