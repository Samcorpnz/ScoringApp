import { NextResponse } from "next/server";

// Synthetic health signal for SA-48's "Sentry spike -> status page incident"
// goal, without Better Stack's paid Sentry connector (Incoming Webhooks and
// Email integrations both require a paid Responder license — confirmed
// 2026-08-24, see infra/betterstack/README.md). Better Stack's free tier
// still includes uptime monitors, so this route lets a free monitor poll a
// derived signal: it queries Sentry's own API for recent error volume and
// fails the check when it's abnormally high, which the status page then
// surfaces the same way it would a real outage.
//
// Deliberately fails OPEN (returns ok) whenever the Sentry query itself
// can't be trusted — missing token, Sentry API error, timeout — so a broken
// integration here never manufactures a false "degraded" status for
// customers. It only reports degraded when the query succeeded and the
// count is genuinely over threshold.
//
// Response body is intentionally just a status string, not the raw count or
// issue details — this endpoint is unauthenticated and polled from outside
// (Better Stack), so it shouldn't leak internal error volume/content.

const SENTRY_ORG = process.env.SENTRY_ORG_SLUG ?? "samcorp-limited";
const SENTRY_PROJECTS = (process.env.SENTRY_ERROR_RATE_PROJECTS ?? "scorehub-relay,scorehub-frontend")
  .split(",")
  .map(p => p.trim())
  .filter(Boolean);
const ERROR_THRESHOLD = Number(process.env.SENTRY_ERROR_RATE_THRESHOLD ?? 20);
const STATS_PERIOD = "5m";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 20_000;

let cache: { expiresAt: number; ok: boolean } | null = null;

async function fetchErrorCount(token: string, project: string): Promise<number> {
  const url = new URL(`https://sentry.io/api/0/organizations/${SENTRY_ORG}/events/`);
  url.searchParams.set("field", "count()");
  url.searchParams.set("query", "level:error");
  url.searchParams.set("project", project);
  url.searchParams.set("statsPeriod", STATS_PERIOD);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Sentry API responded ${res.status} for project ${project}`);

  const body = await res.json();
  return Number(body?.data?.[0]?.["count()"] ?? 0);
}

export async function GET() {
  const token = process.env.SENTRY_ERROR_MONITOR_TOKEN;
  if (!token) {
    return NextResponse.json({ status: "ok", note: "sentry error-rate monitoring not configured" });
  }

  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ status: cache.ok ? "ok" : "degraded" }, { status: cache.ok ? 200 : 503 });
  }

  try {
    const counts = await Promise.all(SENTRY_PROJECTS.map(project => fetchErrorCount(token, project)));
    const total = counts.reduce((sum, n) => sum + n, 0);
    const ok = total < ERROR_THRESHOLD;
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, ok };
    return NextResponse.json({ status: ok ? "ok" : "degraded" }, { status: ok ? 200 : 503 });
  } catch {
    // Sentry API unreachable/misconfigured — fail open, don't page on our
    // own monitoring's own flakiness.
    return NextResponse.json({ status: "ok", note: "sentry query failed, failing open" });
  }
}
