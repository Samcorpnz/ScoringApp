// In-memory sliding-window rate limiter for Next.js API routes / NextAuth
// callbacks. Good enough for a single-instance deployment; on a
// multi-instance/serverless deployment each instance tracks its own window,
// so this is defense-in-depth rather than a precise global limit (SA-81).
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > limit;
}

// Derive the client IP from the trusted proxy position, NOT the first
// X-Forwarded-For entry — that first value is client-supplied, so keying
// limiters on it lets an attacker rotate a forged header per request and
// bypass the throttle entirely. On Vercel the platform sets x-real-ip (and
// appends the real IP as the LAST XFF hop), which the client can't spoof.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  const parts = xff.split(",").map(s => s.trim()).filter(Boolean);
  return parts.at(-1) ?? "unknown";
}
