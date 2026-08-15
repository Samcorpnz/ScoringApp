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
| Object storage | R2 bucket `scorehub-uat`, custom domain `cdn-uat.scorehub.co.nz` | Access key scoped to this bucket only (Object Read & Write), created via the Cloudflare dashboard (not available through `wrangler`/the account API token used for other Cloudflare ops). Account ID `c0c396b5f4c3cf71c2ecb3821febaf92`. |

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

- **CORS**: confirmed — `ALLOWED_ORIGINS` on the relay matches the actual
  Vercel branch-alias URL (`https://scoring-app-git-uat-sam-kerins-projects.vercel.app`),
  verified against a live deployment after the first `uat` push.
- **Stripe**: webhook endpoint URL for UAT is
  `https://scoring-app-git-uat-sam-kerins-projects.vercel.app/api/billing/webhook`
  (stable branch alias). Still needs: creating the endpoint in the
  test-mode Stripe dashboard and setting its signing secret as a
  `uat`-branch-scoped `STRIPE_WEBHOOK_SECRET` on Vercel — until then, UAT
  falls back to the generic Preview environment's webhook secret, so
  webhook events won't reach UAT specifically.
- **Mailgun**: UAT shares the generic Preview environment's Mailgun config
  — real emails will send to real addresses on signup/invite flows tested
  in UAT. Consider a sandbox domain if that's not acceptable.
- **Sentry**: not configured for UAT (optional, no-op when unset).
- **Generic (non-`uat`) Vercel Preview env**: worth independently verifying
  the branch-unscoped `DATABASE_URL`/`NEXT_PUBLIC_RELAY_URL` (used by
  every ad-hoc PR preview) don't point at production — this was flagged
  during UAT setup but not confirmed either way.

## Redeploying / resetting

- Redeploy relay only: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only`
- Reset UAT data back to a copy of prod: `neonctl branches reset UAT --parent --project-id patient-morning-97818497` (or via Neon console)
- Wake a scaled-to-zero relay: any request to `https://scorehub-relay-uat.fly.dev/health` triggers `auto_start_machines`
