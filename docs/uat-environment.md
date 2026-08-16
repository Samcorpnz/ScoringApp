# UAT environment (SA-102 follow-up)

**Decision (2026-08-14):** stand up a persistent UAT stack that mirrors
production end-to-end (relay + DB + frontend), instead of relying solely on
local `docker compose up --build` for pre-prod testing. This replaces the
"No hosted staging environment exists" statement in the root `CLAUDE.md`.

**Why branch-scoped Preview env vars instead of a real Vercel Custom
Environment:** tried on 2026-08-15 — the `sam-kerins-projects` team is on
the Hobby plan, and Vercel's Custom Environments feature (`POST
/v9/projects/{id}/custom-environments`) is Pro/Enterprise-only (`"Cannot
create more than 0 custom environments"`). Same story for Rolling
Releases/canary deploys on Production (`vercel rr configure` — `"Your
current plan does not support rolling releases"`). Revisit both if/when the
team upgrades to Pro.

## What exists

| Layer | Resource | Notes |
| --- | --- | --- |
| Frontend | Vercel `uat` git branch (Preview environment, branch-scoped env vars) | Auto-deploys on every push to `uat` via Vercel's GitHub integration — no Actions job needed. Stable branch-alias URL: `https://scoring-app-git-uat-sam-kerins-projects.vercel.app`. Also live at `app.uat.scorehub.co.nz`, gated by Cloudflare Zero Trust Access (see below) rather than open to the internet. |
| Relay | Fly.io app `scorehub-relay-uat` | Config: `fly.uat.toml` (repo root). Single region (`syd`), `min_machines_running = 0` / `auto_stop_machines = true` so it idles to zero cost between test sessions. Deploys via `.github/workflows/deploy-uat.yml` on push to `uat`, or manually: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only` |
| Database | Neon branch `UAT` (project `ScoringApp`, id `patient-morning-97818497`) | Copy-on-write off `production`. No auto-refresh policy yet — reset with `neonctl branches reset UAT --parent` when data drifts too far from useful. |
| Redis | Upstash `ScoreHub-UAT` (pay-as-you-go, `ap-southeast-2`) | Deliberately a separate database from prod's `ScoreHub` — isolates the Socket.io cross-instance adapter and clock tick-lock so UAT traffic can't touch prod's Redis keyspace. |
| Object storage | R2 bucket `scorehub-uat`, custom domain `cdn-uat.scorehub.co.nz` | Access key scoped to this bucket only (Object Read & Write), created via the Cloudflare dashboard (not available through `wrangler`/the account API token used for other Cloudflare ops). Account ID `c0c396b5f4c3cf71c2ecb3821febaf92`. |
| Marketing site | Cloudflare Worker `scorehub-marketing-uat`, custom domain `uat.scorehub.co.nz` | Deploy: `cd marketing && npm run build && npx wrangler deploy --env uat`. Manual only, no CI job. Uses a Mailgun sandbox domain and routes contact-form submissions to `sam@samcorp.co.nz` instead of `hello@scorehub.co.nz` — see the `uat` env block in `marketing/wrangler.jsonc`. |
| Help centre | Cloudflare Worker `scorehub-help-uat`, custom domain `help.uat.scorehub.co.nz` | Deploy: `cd help && npm run build && npx wrangler deploy --env uat`. Manual only, no CI job. |

UAT hostnames mirror production's structure — bare domain is marketing, `app.` is the frontend, `help.` is the help centre — just with everything nested a level under `uat.`: `uat.scorehub.co.nz` (marketing), `app.uat.scorehub.co.nz` (frontend), `help.uat.scorehub.co.nz` (help centre).

## Access control on `app.uat.scorehub.co.nz`

Unlike marketing and help (public), the frontend on UAT sits behind a **Cloudflare Zero Trust
Access** application (`samcorpltd.cloudflareaccess.com`) scoped to that hostname — visitors hit a
Cloudflare login page before ever reaching Vercel. This is why its DNS record is **Proxied**
(orange cloud) in Cloudflare, unlike every other `*.scorehub.co.nz` record (all DNS-only, grey
cloud) — Access only intercepts traffic that's proxied through Cloudflare's edge.

**Do not switch that record to DNS-only** to "fix" the domain-misconfigured warning in
`vercel domains inspect app.uat.scorehub.co.nz` — that warning is cosmetic in this setup (Vercel
can't complete its own DNS-based verification while Cloudflare proxies the record) and the site
works fine regardless; unproxying it would remove the Access gate instead. Vercel's own
project-level deployment protection (Vercel Authentication / SSO) is left enabled as normal —
Cloudflare Access already gates this hostname before requests reach Vercel, so it doesn't add a
second login for testers, and turning it off project-wide would also strip protection from every
ad-hoc PR preview deployment (Vercel's Hobby plan has no per-branch protection setting — see the
Custom Environments note above).

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

- **`app.uat.scorehub.co.nz` branch targeting — worth double-checking**: `app.uat.scorehub.co.nz`
  was registered on the `scoring-app` Vercel project and confirmed loading past the Cloudflare
  Access gate on 2026-08-15, but whether it was explicitly assigned to Git Branch `uat` in the
  Vercel dashboard (Settings → Domains) — as opposed to falling back to serving **Production** —
  was never independently confirmed. Verify by checking it's talking to the UAT relay/DB (e.g. a
  match created there shouldn't appear in production) before relying on it for real UAT testing;
  if it turns out to be serving Production, do the branch assignment in the dashboard (no CLI/API
  path exists for this).
- **CORS**: confirmed — `ALLOWED_ORIGINS` on the relay matches the actual
  Vercel branch-alias URL (`https://scoring-app-git-uat-sam-kerins-projects.vercel.app`),
  verified against a live deployment after the first `uat` push.
- **Stripe**: webhook endpoint URL for UAT is
  `https://scoring-app-git-uat-sam-kerins-projects.vercel.app/api/billing/webhook`
  (stable branch alias). A `uat`-branch-scoped `STRIPE_WEBHOOK_SECRET` is
  now set on Vercel (2026-08-15) — confirm the endpoint in the test-mode
  Stripe dashboard still points at the branch-alias URL above if webhook
  events stop arriving.
- **Mailgun**: UAT shares the generic Preview environment's Mailgun config
  — real emails will send to real addresses on signup/invite flows tested
  in UAT. Consider a sandbox domain if that's not acceptable.
- **Sentry**: `uat`-branch-scoped `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, and `SENTRY_ENVIRONMENT` are now set on
  Vercel (2026-08-15).
- **Generic (non-`uat`) Vercel Preview env**: worth independently verifying
  the branch-unscoped `DATABASE_URL`/`NEXT_PUBLIC_RELAY_URL` (used by
  every ad-hoc PR preview) don't point at production — this was flagged
  during UAT setup but not confirmed either way.

## Redeploying / resetting

- Redeploy relay only: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only`
- Reset UAT data back to a copy of prod: `neonctl branches reset UAT --parent --project-id patient-morning-97818497` (or via Neon console)
- Wake a scaled-to-zero relay: any request to `https://scorehub-relay-uat.fly.dev/health` triggers `auto_start_machines`
