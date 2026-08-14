# UAT environment (SA-102 follow-up)

**Decision (2026-08-14):** stand up a persistent UAT stack that mirrors
production end-to-end (relay + DB + frontend), instead of relying solely on
local `docker compose up --build` for pre-prod testing. This replaces the
"No hosted staging environment exists" statement in the root `CLAUDE.md`.

## What exists

| Layer | Resource | Notes |
| --- | --- | --- |
| Frontend | Vercel `uat` git branch (Preview environment, branch-scoped env vars) | Auto-deploys on every push to `uat` via Vercel's GitHub integration — no Actions job needed. URL: `https://scoring-app-git-uat-sam-kerins-projects.vercel.app` |
| Relay | Fly.io app `scorehub-relay-uat` | Config: `fly.uat.toml` (repo root). Single region (`syd`), `min_machines_running = 0` / `auto_stop_machines = true` so it idles to zero cost between test sessions. Deploys via `.github/workflows/deploy-uat.yml` on push to `uat`, or manually: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only` |
| Database | Neon branch `UAT` (project `ScoringApp`, id `patient-morning-97818497`) | Copy-on-write off `production`. No auto-refresh policy yet — reset with `neonctl branches reset UAT --parent` when data drifts too far from useful. |
| Redis | Upstash `ScoreHub-UAT` (pay-as-you-go, `ap-southeast-2`) | Deliberately a separate database from prod's `ScoreHub` — isolates the Socket.io cross-instance adapter and clock tick-lock so UAT traffic can't touch prod's Redis keyspace. |

## Secrets

`AUTH_SECRET` is a **distinct** value from production, set identically on
both the Fly app and the Vercel `uat` branch — this is what lets the
frontend's `/api/control-token` JWTs verify against the UAT relay. It must
never be reused across environments (a UAT token must not verify against
prod, or vice versa).

- Fly: `fly secrets list -a scorehub-relay-uat` (values not readable back —
  see `fly secrets set` history / your password manager if rotating)
- Vercel: `vercel env ls` — filter for `Branch uat`, or
  `vercel env pull --environment=preview --git-branch=uat`

## Known gaps / not yet done

- **CORS**: `ALLOWED_ORIGINS` on the relay is set to the predicted Vercel
  branch-alias URL (`https://scoring-app-git-uat-sam-kerins-projects.vercel.app`).
  Confirm this matches the actual deployed URL after the first `uat` push —
  Vercel's alias pattern is `<project>-git-<branch>-<team-slug>.vercel.app`
  but hasn't been verified against a live deployment yet.
- **Stripe**: no dedicated test-mode webhook endpoint exists for the UAT
  URL yet. UAT currently shares the generic Preview environment's Stripe
  test keys/webhook secret (fine for test-mode keys, but webhook events
  won't reach UAT specifically until a UAT-targeted endpoint is added in
  the Stripe test-mode dashboard).
- **Mailgun**: UAT shares the generic Preview environment's Mailgun config
  — real emails will send to real addresses on signup/invite flows tested
  in UAT. Consider a sandbox domain if that's not acceptable.
- **R2**: not provisioned for UAT. Logo/sound upload testing will fall back
  to local-disk `UPLOAD_DIR` behavior on the relay (ephemeral, wiped on
  redeploy) until/unless a `scorehub-uploads-uat` bucket is added.
- **Sentry**: not configured for UAT (optional, no-op when unset).
- **Generic (non-`uat`) Vercel Preview env**: worth independently verifying
  the branch-unscoped `DATABASE_URL`/`NEXT_PUBLIC_RELAY_URL` (used by
  every ad-hoc PR preview) don't point at production — this was flagged
  during UAT setup but not confirmed either way.

## Redeploying / resetting

- Redeploy relay only: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only`
- Reset UAT data back to a copy of prod: `neonctl branches reset UAT --parent --project-id patient-morning-97818497` (or via Neon console)
- Wake a scaled-to-zero relay: any request to `https://scorehub-relay-uat.fly.dev/health` triggers `auto_start_machines`
