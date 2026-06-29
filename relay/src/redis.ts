import { randomUUID } from "crypto";
import Redis from "ioredis";

const TICK_LOCK_TTL_MS = 2500;
const STATE_SYNC_CHANNEL = "matchstate-sync";
const instanceId = randomUUID();

let clients: { pub: Redis; sub: Redis } | null | undefined;

// Lazily created and cached, mirroring the DATABASE_URL no-op pattern in
// persistence.ts — when REDIS_URL is unset (local dev, tests), this returns
// null and the relay behaves exactly as a single in-memory instance.
export function getRedisClients(): { pub: Redis; sub: Redis } | null {
  if (clients !== undefined) return clients;
  if (!process.env.REDIS_URL) {
    clients = null;
    return clients;
  }
  clients = {
    pub: new Redis(process.env.REDIS_URL),
    sub: new Redis(process.env.REDIS_URL),
  };
  return clients;
}

// Atomically claims (or renews) leadership for ticking a given org's clock,
// so that when multiple relay instances share an org's cached state, only
// one of them advances the clock per second. Lock TTL exceeds the 1s tick
// interval to tolerate one missed renewal before another instance can take
// over from a dead leader.
const TICK_LOCK_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == false or current == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return 1
end
return 0
`;

export interface EvalCapable {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

// Pulled out of acquireTickLock so the lock logic can be unit-tested against
// a fake client, without needing a real Redis connection.
export async function acquireTickLockWith(
  client: EvalCapable,
  orgId: string,
  ownerId: string,
  ttlMs: number = TICK_LOCK_TTL_MS
): Promise<boolean> {
  const result = await client.eval(TICK_LOCK_SCRIPT, 1, `tick-lock:${orgId}`, ownerId, ttlMs);
  return result === 1;
}

export async function acquireTickLock(orgId: string): Promise<boolean> {
  const redisClients = getRedisClients();
  if (!redisClients) return true;
  return acquireTickLockWith(redisClients.pub, orgId, instanceId);
}

// Every relay instance keeps its own in-memory MatchState cache (server.ts's
// `matchStates` Map) for speed, but only the instance that handled a given
// write has the fresh value — the others fall back to a debounced (2s)
// Postgres read until they happen to take over that org themselves. During a
// failover (SA-56), a client that reconnects to a *different* instance than
// the one it was on can briefly see a stale cached snapshot from before the
// other instance's writes. Publishing every write here lets every instance
// keep its local cache current within Redis pub/sub latency instead.
export interface PublishCapable {
  publish(channel: string, message: string): unknown;
}

export function publishStateUpdateWith(client: PublishCapable, orgId: string, state: unknown): void {
  client.publish(STATE_SYNC_CHANNEL, JSON.stringify({ orgId, state }));
}

export function publishStateUpdate(orgId: string, state: unknown): void {
  const redisClients = getRedisClients();
  if (!redisClients) return;
  publishStateUpdateWith(redisClients.pub, orgId, state);
}

// Returns null for anything that isn't a well-formed { orgId, state } sync
// message, so callers can drop it the same way a malformed bridge/control
// socket payload is dropped elsewhere in the relay.
export function parseStateSyncMessage(raw: string): { orgId: string; state: unknown } | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.orgId !== "string" || !("state" in parsed)) return null;
    return { orgId: parsed.orgId, state: parsed.state };
  } catch {
    return null;
  }
}

export interface SubscribeCapable {
  subscribe(channel: string): unknown;
  on(event: "message", listener: (channel: string, message: string) => void): unknown;
}

export function subscribeStateUpdatesWith(
  client: SubscribeCapable,
  onUpdate: (orgId: string, state: unknown) => void
): void {
  client.subscribe(STATE_SYNC_CHANNEL);
  client.on("message", (channel, raw) => {
    if (channel !== STATE_SYNC_CHANNEL) return;
    const message = parseStateSyncMessage(raw);
    if (!message) {
      console.warn("[relay] dropped malformed matchstate-sync message");
      return;
    }
    onUpdate(message.orgId, message.state);
  });
}

export function subscribeStateUpdates(onUpdate: (orgId: string, state: unknown) => void): void {
  const redisClients = getRedisClients();
  if (!redisClients) return;
  subscribeStateUpdatesWith(redisClients.sub, onUpdate);
}

export async function closeRedis(): Promise<void> {
  if (!clients) return;
  await Promise.all([clients.pub.quit(), clients.sub.quit()]);
  clients = null;
}
