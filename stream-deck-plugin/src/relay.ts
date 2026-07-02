import { io, Socket } from "socket.io-client";
import type { MatchState } from "./types.js";

type Listener = (state: MatchState) => void;

class RelayClient {
  private socket: Socket | null = null;
  private state: MatchState | null = null;
  private listeners = new Set<Listener>();
  private orgId: string | null = null;
  private matchId: string | undefined;

  relayUrl = "";
  token = "";

  // Called when global settings are saved in the PI. Fetches orgId/matchId
  // from /api/me, then opens a viewer socket for live state updates.
  async init(relayUrl: string, token: string): Promise<void> {
    this.relayUrl = relayUrl.replace(/\/$/, "");
    this.token = token;

    const res = await fetch(`${this.relayUrl}/api/me`, {
      headers: { "x-control-secret": token },
    });
    if (!res.ok) throw new Error(`/api/me returned ${res.status}`);

    const { orgId, matchId } = (await res.json()) as { orgId: string; matchId: string | null };
    this.orgId = orgId;
    this.matchId = matchId ?? undefined;
    this.connect();
  }

  private connect(): void {
    this.socket?.disconnect();
    if (!this.orgId) return;

    this.socket = io(this.relayUrl, {
      auth: { orgId: this.orgId, matchId: this.matchId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("matchStateChange", (incoming: MatchState) => {
      this.state = incoming;
      for (const fn of this.listeners) fn(incoming);
    });
  }

  // Returns an unsubscribe function. Immediately calls the listener with the
  // last known state so buttons render without waiting for the next update.
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    if (this.state) fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState(): MatchState | null {
    return this.state;
  }

  // HTTP POST to a relay action endpoint, authenticated with the CONTROL token.
  async callAction(path: string, params: Record<string, string | number> = {}): Promise<void> {
    if (!this.relayUrl || !this.token) return;
    const url = new URL(`${this.relayUrl}/action/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    if (this.matchId) url.searchParams.set("matchId", this.matchId);
    await fetch(url.toString(), {
      method: "POST",
      headers: { "x-control-secret": this.token },
    });
  }
}

export const relay = new RelayClient();
