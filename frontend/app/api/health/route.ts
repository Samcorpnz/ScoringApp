import { NextResponse } from "next/server";

// Unauthenticated liveness check for external uptime monitors (SA-48) —
// mirrors relay's /health (relay/src/server.ts): no dependency on Postgres
// or any downstream service, so it reflects whether this Vercel deployment
// is serving requests, not whether its backing stores are reachable.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
