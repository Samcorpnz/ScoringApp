# Database backup & recovery posture (SA-57)

**Decision (2026-06-28):** stay on Neon's and Upstash's free tiers — including
no paid multi-AZ/standby upgrade — until there are paying customers to
justify the recurring cost. This document records what that actually buys
us today (not what the marketing pages imply), plus a free DIY backup
supplement that closes the biggest real gap.

## What's actually at risk

This app has two stateful backends, but they don't carry equal weight:

- **Postgres (Neon)** is the system of record — accounts, orgs, matches,
  billing entitlements. Losing data here is a real, user-visible loss.
- **Redis (Upstash)** holds no authoritative data. It's only used for the
  Socket.io cross-instance broadcast adapter, a clock tick-lock, and the
  cross-instance cache-sync channel added for SA-56 (`relay/src/redis.ts`).
  If Upstash were to disappear entirely, the relay degrades to
  single-instance behavior (cache sync and clock-tick coordination stop) —
  it does not lose any match data, because none lives there.

So SA-57's "select multi-AZ tiers for Postgres *and* Redis" framing
overstates the Redis side for this app specifically. The durability
question that actually matters is Postgres.

## Current RPO/RTO (Neon free tier, no paid upgrade)

- **Point-in-time recovery**: automatic, no setup required. Free tier keeps
  up to **6 hours** of change history, capped at **1GB** of changes —
  whichever limit is hit first. At current (pre-launch) traffic this is
  effectively a multi-day window in practice, since real change volume is
  far below 1GB/day.
- **AZ failure recovery**: Neon's storage layer (the safekeeper/pageserver
  tier that holds WAL and data) is distributed across availability zones
  as part of its core architecture — this is not a paid-tier-gated feature.
  Neon's own docs cite ~1–10 minutes to recover from an AZ failure. What
  *is* gated behind a paid plan is a standby **compute** node for
  near-zero-downtime failover of query serving specifically — without it,
  an AZ failure means a brief (minutes, not hours) reconnect gap for the
  relay's DB connection, not data loss. The relay already tolerates this
  gracefully: `setState()` writes are fire-and-forget against the DB
  (`relay/src/server.ts`), so a transient DB hiccup doesn't block live
  Socket.io broadcasts to connected clients.
- **What free tier does *not* include**: scheduled/automated backups, and
  only 1 manual snapshot. If a bad migration or a bug silently corrupts
  data slowly over more than 6 hours / 1GB of changes before anyone
  notices, free-tier PITR alone won't reach far enough back.

## The gap, and the free fix

The real exposure is that 6-hour/1GB PITR window — not AZ failure (already
handled by Neon's architecture) and not Redis (holds nothing durable).

`.github/workflows/backup-db.yml` runs a daily `pg_dump` against production
and uploads it to the existing `scorehub-prod` R2 bucket under a
`db-backups/` prefix — no new infrastructure, reuses credentials/storage
that's already paid for via the logo/sound upload feature (R2's pricing has
no egress fees and `db-backups/` is a trivial fraction of bucket size).
This gives a daily recovery point independent of Neon's PITR window, at
zero additional recurring cost.

**One-time setup (repo admin, not done as part of this change):**
1. Add GitHub repo secrets: `DATABASE_URL` (production Neon connection
   string), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET` (the `scorehub-prod` bucket name) — same R2 credentials
   already used for logo/sound uploads, just added to GitHub Actions too.
2. In the Cloudflare R2 dashboard, add a lifecycle rule on `scorehub-prod`
   to delete objects under `db-backups/` after some retention window (e.g.
   30 days) — this bounds storage growth without any custom cleanup code.
3. Confirm the `production` GitHub Environment (already used by
   `deploy.yml`) is the right approval gate for this workflow, or split it
   into its own environment if backups shouldn't require the same
   reviewers as a deploy.

**Restore procedure** (not yet rehearsed — flagging the same way SA-59's
runbook flags its own unrehearsed rehearsal): download the relevant
`.dump` file from R2, then `pg_restore --no-owner --no-acl -d
"$DATABASE_URL" backup-<timestamp>.dump` against a fresh Neon branch (not
directly against production) to verify it before ever using it against a
real incident.

## Revisit when

- Paying customers exist — at that point, re-run this analysis against
  Neon's Launch tier (7-day PITR, scheduled backups) and Upstash's Prod
  Pack ($200/mo, multi-zone HA), and decide based on actual usage/SLA
  commitments made to customers, not pre-emptively.
- Match data volume grows enough that the 1GB free-tier PITR cap becomes
  the binding constraint instead of the 6-hour window.
