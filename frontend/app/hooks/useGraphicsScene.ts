"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";

export interface GraphicsScene {
  sceneType: string;
  payload?: Record<string, unknown>;
  updatedAt: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

// Graphics Operator add-on scene channel — modeled directly on
// useMatchState.ts, but a separate socket connection/event stream
// (graphicsSceneUpdate) rather than folding scene state into MatchState.
// Used two ways: authenticated (secret+role: "control"|"graphics") by
// /control/graphics to both display the current scene and call setScene();
// unauthenticated (org/matchId from the page's query params, same as a
// viewer connecting to useMatchState) by /display/graphics to just listen.
export function useGraphicsScene(auth?: { secret: string; role: "control" | "graphics" }) {
  const [sceneState, setSceneState] = useState<GraphicsScene | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<Socket | null>(null);
  const secret = auth?.secret;
  const role = auth?.role;

  useEffect(() => {
    const params = secret === undefined && globalThis.window !== undefined
      ? new URLSearchParams(globalThis.location.search)
      : undefined;
    const orgId = params?.get("org") ?? undefined;
    const matchId = params?.get("matchId") ?? undefined;

    let socketAuth: { secret: string; role: "control" | "graphics" | undefined } | { orgId: string; matchId?: string } | Record<string, never>;
    if (secret !== undefined) {
      socketAuth = { secret, role };
    } else if (orgId) {
      socketAuth = { orgId, matchId };
    } else {
      socketAuth = {};
    }

    const socket = io(RELAY_URL, {
      auth: socketAuth,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));

    socket.on("graphicsSceneUpdate", (incoming: GraphicsScene) => {
      setSceneState(incoming);
    });

    return () => { socket.disconnect(); };
  }, [secret, role]);

  const setScene = (sceneType: string, payload?: Record<string, unknown>) => {
    socketRef.current?.emit("setScene", { sceneType, payload });
  };

  return { scene: sceneState, status, setScene };
}
