"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MatchState, DEFAULT_MATCH_STATE } from "../types";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

// If a hardware input source is configured, the bridge should be pushing
// state updates continuously — no update within this window means the
// bridge's socket is up but its hardware feed has gone quiet (SA-67).
const FEED_STALE_MS = 8_000;
const FEED_STALE_CHECK_MS = 1_000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useMatchState(auth?: { secret: string; role: string }) {
  const [state, setState] = useState<MatchState>({ ...DEFAULT_MATCH_STATE });
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [feedStale, setFeedStale] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;
  const secret = auth?.secret;
  const role = auth?.role;

  useEffect(() => {
    // Viewers/displays have no secret — scope them to an org via the page's
    // ?org= query param so multiple tenants on one relay stay isolated.
    const orgId = secret === undefined && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("org") ?? undefined
      : undefined;

    const socket = io(RELAY_URL, {
      auth: secret !== undefined ? { secret, role } : orgId ? { orgId } : {},
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect",    () => { setStatus("connected"); lastUpdateRef.current = Date.now(); setFeedStale(false); });
    socket.on("disconnect", () => { setStatus("disconnected"); setFeedStale(false); });
    socket.on("connect_error", () => { setStatus("disconnected"); setFeedStale(false); });

    socket.on("matchStateChange", (incoming: MatchState) => {
      lastUpdateRef.current = Date.now();
      setFeedStale(false);
      setState(prev =>
        incoming.sequenceId >= prev.sequenceId ? incoming : prev
      );
    });

    return () => { socket.disconnect(); };
  }, [secret, role]);

  useEffect(() => {
    const interval = setInterval(() => {
      const shouldBeStale =
        status === "connected" &&
        stateRef.current.inputSource !== "none" &&
        Date.now() - lastUpdateRef.current >= FEED_STALE_MS;
      setFeedStale(shouldBeStale);
    }, FEED_STALE_CHECK_MS);
    return () => clearInterval(interval);
  }, [status]);

  const sendManualUpdate = (patch: Partial<MatchState>) => {
    socketRef.current?.emit("manualUpdate", patch);
  };

  const sendReset = () => {
    socketRef.current?.emit("resetMatch");
  };

  return { state, status, feedStale, sendManualUpdate, sendReset };
}
