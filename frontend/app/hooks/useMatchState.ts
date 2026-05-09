"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MatchState, DEFAULT_MATCH_STATE } from "../types";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useMatchState(auth?: { secret: string; role: string }) {
  const [state, setState] = useState<MatchState>({ ...DEFAULT_MATCH_STATE });
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(RELAY_URL, {
      auth: auth ?? {},
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect",    () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));

    socket.on("matchStateChange", (incoming: MatchState) => {
      setState(prev =>
        incoming.sequenceId >= prev.sequenceId ? incoming : prev
      );
    });

    return () => { socket.disconnect(); };
  }, []);

  const sendManualUpdate = (patch: Partial<MatchState>) => {
    socketRef.current?.emit("manualUpdate", patch);
  };

  const sendReset = () => {
    socketRef.current?.emit("resetMatch");
  };

  return { state, status, sendManualUpdate, sendReset };
}
