/**
 * Path 3 (Phase D) — a synthetic second provider proving the graphics
 * ingestion pipeline isn't Champion-Data-shaped: transport is event-driven
 * push (like a websocket feed) rather than HTTP polling
 * (championDataJsonSource.ts), and the payload shape/field paths are
 * unrelated to Champion Data's. It carries no score-critical parsing of its
 * own — it's a graphics-feed-only harness for testing/demoing the
 * multi-provider registry, not a real vendor integration.
 *
 * Usage: construct a PushFeed (any EventEmitter), call startPushSource() to
 * wire it up, then emit("message", rawPayload) whenever new data arrives —
 * from a websocket "message" handler, a message queue consumer, etc.
 */

import { EventEmitter } from "node:events";
import { Socket } from "socket.io-client";
import { MatchState } from "../types";
import { buildGraphicsFeed, GraphicsFeed } from "../graphics/feedTransform";
import { findFeedMapping } from "../graphics/feedMappingRegistry";

export type PushFeed = EventEmitter;

export interface PushSourceOptions {
  /** Provider id used to look up a graphics feed-mapping (default "mockpush"). */
  provider?: string;
}

// Never throws — a graphics-mapping failure must never affect score state.
function buildGraphicsFeedSafely(
  raw: unknown,
  state: MatchState,
  provider: string
): GraphicsFeed | undefined {
  try {
    const mapping = findFeedMapping(provider, state.sport);
    if (!mapping) return state.graphicsFeed;
    return buildGraphicsFeed(raw, mapping, state.graphicsFeed?.version ?? 0) ?? state.graphicsFeed;
  } catch (err) {
    console.error(`[mock-push] graphics feed mapping error: ${(err as Error).message}`);
    return state.graphicsFeed;
  }
}

export function startPushSource(
  socket: Socket,
  getState: () => MatchState,
  setState: (s: MatchState) => void,
  feed: PushFeed,
  options: PushSourceOptions = {}
): () => void {
  const provider = options.provider ?? "mockpush";

  const onMessage = (raw: unknown) => {
    const state = getState();
    const graphicsFeed = buildGraphicsFeedSafely(raw, state, provider);
    if (!graphicsFeed || graphicsFeed === state.graphicsFeed) return;
    const next = { ...state, graphicsFeed };
    setState(next);
    if (socket.connected) socket.emit("stateUpdate", next);
  };

  feed.on("message", onMessage);
  console.log(`[mock-push] Listening for pushed graphics payloads (provider: ${provider})`);

  return () => {
    feed.off("message", onMessage);
  };
}
