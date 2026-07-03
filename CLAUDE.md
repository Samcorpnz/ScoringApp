# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System overview

Live sport scoring display. Three deployables, data flowing one direction:

```
Saturn/Vega Console (RS422/serial)
      ↓
  bridge/   ← runs on the operator's venue laptop; parses serial protocol
      ↓  Socket.io push (authenticated)
  relay/    ← cloud server (Fly.io, multi-region), holds live MatchState in memory
      ↓  Socket.io broadcast
  frontend/ ← Next.js app (Vercel) — /display/* (viewers) and /control (operator)
```

`packages/types` (`@scorehub/types`) and `packages/db` (`@scorehub/db`, Prisma) are shared
workspaces consumed by both `frontend` and `relay`. This is an npm workspaces monorepo — always
run installs from the repo root (`npm install`), not inside a sub-package.

## Commands

Run from repo root unless noted. Each sub-package (`frontend`, `relay`, `bridge`, `packages/db`)
has its own `package.json`; use `--workspace=<name>` or `cd` into it.

```bash
npm run dev:relay          # relay on :4000
npm run dev:frontend       # frontend on :3000 (bridge has no root script — cd bridge && npm run dev)
npm run build:relay
npm run build:frontend
npm run db:migrate         # prisma migrate dev, from packages/db

npm test                   # all workspaces, --if-present
npm test --workspace=relay
npm test --workspace=frontend      # vitest
npm test --workspace=bridge        # jest — protocol parser tests
```

Single test file:
```bash
cd relay && npx jest src/__tests__/entitlements.test.ts
cd bridge && npx jest src/__tests__/saturnParser.test.ts
cd frontend && npx vitest run app/__tests__/sportTemplates.test.ts
```

Frontend also needs, before `next build`/`npx tsc --noEmit` will succeed, `@scorehub/db` built
first: `npm run build --workspace=packages/db`. CI (`.github/workflows/test.yml`) runs, per
package: `npm audit --omit=dev --audit-level=high`, then (frontend only) `tsc --noEmit`, `eslint`,
tests, `next build`.

Docker Compose (`docker-compose.yml`) spins up Postgres, Redis, relay, and frontend together for
local dev without needing Neon/Upstash accounts — the bridge still runs natively since serial
ports don't pass cleanly into containers.

## Adding a new sport

The codebase is config-driven. A "drop-in" sport (standard scoring, no bespoke control panel)
touches exactly 4 files:

1. `packages/types/index.ts` — add to the `SportType` union
2. `frontend/app/sport-templates.ts` — add a `SportTemplate` object (`scoreIncrements`,
   `resetScoreOnPeriod`, optional `matchConfig` for match-creation config fields, optional
   `controlPanel` component override)
3. `relay/src/schemas.ts` — add to the Zod `sportSchema` enum
4. `relay/src/server.ts` — add to `SPORT_DEFAULT_CLOCK` (and `SPORT_RESET_SCORE_ON_PERIOD` if
   the sport zeroes scores between games/sets)

Sports with bespoke state or UI (cricket, softball, indoor cricket) additionally define a state
type in `packages/types/sports/<sport>.ts`, added to the `sportState` discriminated union
(`state.sport` narrows it), and can supply a custom `ScoreTab` panel component instead of the
generic one. See `docs/multi-sport-expansion-plan.md` for the full phased rollout, per-sport
scoring rules, and rationale for this architecture (it replaced hardcoded `if (sport ===
"netball")` branches scattered across the control UI).

Adding a new console/protocol source (beyond Saturn/Vega): write a parser in
`bridge/src/protocol/` and register it in `bridge/src/index.ts`.

## Auth & multi-tenancy model

Three distinct credential types accepted by the relay (`relay/src/auth.ts`), each serving a
different caller:

- **Control JWT** — short-lived, minted by the frontend's `/api/control-token` route from the
  logged-in user's session (requires ADMIN/MANAGER/OPERATOR role). Used by the control panel.
- **CONTROL ScopedToken** — long-lived, DB-backed (hashed with SHA-256, never stored raw), for
  Stream Deck / webhook callers that can't do an interactive login.
- **BRIDGE ScopedToken** — long-lived, per-org, generated from the control panel's Settings tab;
  authenticates the venue-laptop bridge process.

When `DATABASE_URL` is unset (local dev / Jest, or a self-hosted single-tenant deployment with no
billing), all three auth functions fall back to comparing against a shared `legacySecret` and
route everything into `LEGACY_ROOM_ID` — there's no org/account model to check. Don't assume
`DATABASE_URL` is always set when touching `relay/src/auth.ts`, `entitlements.ts`, or
`persistence.ts`.

Plan gating (`relay/src/entitlements.ts`) — e.g. Free tier's one-concurrent-live-match limit — is
also a no-op in legacy mode. `requirePlan()` middleware must run after `controlAuth` (needs
`req.orgId`) and after rate-limiting, so unauthenticated requests are throttled before hitting DB
lookups.

Prisma schema (`packages/db/prisma/schema.prisma`): `Account` → `Org` (hierarchical, self-referencing
`parentOrgId`) → `Membership` (role-based) → `User`; `Match`, `Invitation`, `ScopedToken`,
`StripeEvent`, `EmailChangeRequest` round out the model.

## Serial protocol (bridge)

**Saturn/Vega (Swiss Timing)**, spec 0100.073.02 v2.0 — 9600 baud, 8N1, RS422. Messages are
framed with STX/ETX + XOR checksum. Cycle: `D` (match state) + `F1`/`F2` (player shirts) +
`F3`/`F4` (points) + `T` (time/config) + `N` (names). Parser: `bridge/src/protocol/saturnParser.ts`.

ChampionData is a second, non-serial source (`bridge/src/sources/championData*`) — JSON polling
or scraping — for sports where no physical console feeds the bridge.

## Deployment

Human-gated: `.github/workflows/deploy.yml` runs the full test suite then deploys relay (Fly.io)
and frontend (Vercel), gated behind a `production` GitHub Environment with required reviewers.
Fly.io's and Vercel's own git-push auto-deploy must stay disabled in their dashboards — otherwise
every push deploys immediately, bypassing this gate. `AUTH_SECRET` must be identical between relay
and frontend deployments (it's the shared JWT signing key for control tokens).
