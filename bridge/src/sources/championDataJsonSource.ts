/**
 * Path 1 — Poll a ChampionData JSON endpoint with HTTP Basic Auth.
 *
 * Env vars:
 *   CD_URL          Full URL to the JSON feed
 *   CD_USERNAME     Basic auth username
 *   CD_PASSWORD     Basic auth password
 *   CD_POLL_MS      Poll interval in ms (default 2000)
 */

import fetch from "node-fetch";
import { Socket } from "socket.io-client";
import { MatchState } from "../types";
import { parseChampionDataJson } from "../protocol/championDataParser";

export interface JsonSourceOptions {
  url: string;
  username?: string;
  password?: string;
  pollMs?: number;
}

// Restricts outgoing requests to http/https and rejects private-network targets
// to prevent SSRF via a user-supplied URL.
function validateRemoteUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`CD_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`CD_URL must use http or https scheme, got: ${parsed.protocol}`);
  }
  const h = parsed.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    throw new Error(`CD_URL must not target a private or loopback address: ${h}`);
  }
}

export function startJsonSource(
  socket: Socket,
  getState: () => MatchState,
  setState: (s: MatchState) => void,
  options: JsonSourceOptions
): () => void {
  const { url, username, password } = options;
  const pollMs = Math.max(100, Math.min(60_000, options.pollMs ?? 2000));
  validateRemoteUrl(url);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (username && password) {
    const creds = Buffer.from(`${username}:${password}`).toString("base64");
    headers["Authorization"] = `Basic ${creds}`;
  }

  let active = true;

  async function poll(): Promise<void> {
    if (!active) return;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`[cd-json] HTTP ${res.status} from ${url}`);
      } else {
        const json = await res.json();
        const next = parseChampionDataJson(json, getState());
        setState(next);
        if (socket.connected) socket.emit("stateUpdate", next);
      }
    } catch (err) {
      console.error("[cd-json] Fetch error:", (err as Error).message);
    }

    if (active) setTimeout(poll, pollMs);
  }

  console.log(`[cd-json] Polling ${url} every ${pollMs}ms`);
  poll();

  return () => {
    active = false;
  };
}

export function jsonSourceOptionsFromEnv(): JsonSourceOptions {
  const url = process.env.CD_URL;
  if (!url) throw new Error("CD_URL is required for cd-json source");
  return {
    url,
    username: process.env.CD_USERNAME,
    password: process.env.CD_PASSWORD,
    pollMs: parseInt(process.env.CD_POLL_MS ?? "2000", 10),
  };
}
