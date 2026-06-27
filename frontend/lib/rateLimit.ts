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

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
