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
import dns, { LookupAddress } from "dns";
import http from "http";
import https from "https";
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
  if (isPrivateOrReservedHost(h)) {
    throw new Error(`CD_URL must not target a private or loopback address: ${h}`);
  }
}

// Covers loopback, RFC1918 private ranges, link-local (incl. the
// 169.254.169.254 cloud metadata endpoint), CGNAT, and the IPv6
// equivalents — not just the handful of ranges checked previously.
function isPrivateOrReservedHost(h: string): boolean {
  if (h === "localhost" || h === "0.0.0.0" || h === "::" || h === "::1") return true;
  if (
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("169.254.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)
  ) {
    return true;
  }
  if (h.startsWith("::ffff:")) return isPrivateOrReservedHost(h.slice(7));
  if (/^(fe80|fc[0-9a-f]{2}|fd[0-9a-f]{2}):/.test(h)) return true;
  return false;
}

// Re-validates the *resolved* address at connection time, not just the
// configured hostname string. Without this, a hostname that resolves to a
// public IP during validation could later resolve to a private/metadata
// address (DNS rebinding) and the request would still go through.
function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family: number) => void
): void {
  dns.lookup(hostname, options, (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family: number) => {
    if (err) return callback(err, address, family);
    const addresses: string[] = Array.isArray(address) ? address.map(a => a.address) : [address];
    const unsafe = addresses.find(isPrivateOrReservedHost);
    if (unsafe) {
      return callback(new Error(`Resolved address for ${hostname} is private/reserved: ${unsafe}`), address, family);
    }
    callback(null, address, family);
  });
}

const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup });

function selectSafeAgent(parsedUrl: URL): http.Agent | https.Agent {
  return parsedUrl.protocol === "http:" ? safeHttpAgent : safeHttpsAgent;
}

// Bounds the poll interval to [100ms, 60s]. Math.min/max alone aren't safe
// here: a malformed CD_POLL_MS produces NaN, and NaN poisons both Math.min
// and Math.max, so the "clamp" silently lets an unbounded value (and the
// resulting CPU/network busy-loop) through.
function clampPollMs(value: number | undefined, fallback: number): number {
  const v = Number.isFinite(value) ? (value as number) : fallback;
  if (v < 100) return 100;
  if (v > 60_000) return 60_000;
  return v;
}

export function startJsonSource(
  socket: Socket,
  getState: () => MatchState,
  setState: (s: MatchState) => void,
  options: JsonSourceOptions
): () => void {
  const { url, username, password } = options;
  const pollMs = clampPollMs(options.pollMs, 2000);
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
      const res = await fetch(url, { headers, agent: selectSafeAgent });
      if (!res.ok) {
        console.warn(`[cd-json] HTTP ${res.status} from ${url}`);
      } else {
        const json = await res.json();
        const next = parseChampionDataJson(json, getState());
        setState(next);
        if (socket.connected) socket.emit("stateUpdate", next);
      }
    } catch (err) {
      console.error(`[cd-json] Fetch/parse error for ${url}: ${(err as Error).message}`);
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
