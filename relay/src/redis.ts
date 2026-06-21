import { randomUUID } from "crypto";
import Redis from "ioredis";

const TICK_LOCK_TTL_MS = 2500;
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

export async function closeRedis(): Promise<void> {
  if (!clients) return;
  await Promise.all([clients.pub.quit(), clients.sub.quit()]);
  clients = null;
}
