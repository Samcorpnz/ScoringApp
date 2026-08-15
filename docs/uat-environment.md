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
| Frontend | Vercel `uat` git branch (Preview environment, branch-scoped env vars) | Auto-deploys on every push to `uat` via Vercel's GitHub integration — no Actions job needed. Stable branch-alias URL: `https://scoring-app-git-uat-sam-kerins-projects.vercel.app`. `app.uat.scorehub.co.nz` is registered on the `scoring-app` Vercel project as of 2026-08-15 but **not yet live** — see "Known gaps" below. |
| Relay | Fly.io app `scorehub-relay-uat` | Config: `fly.uat.toml` (repo root). Single region (`syd`), `min_machines_running = 0` / `auto_stop_machines = true` so it idles to zero cost between test sessions. Deploys via `.github/workflows/deploy-uat.yml` on push to `uat`, or manually: `flyctl deploy -c fly.uat.toml -a scorehub-relay-uat --remote-only` |
| Database | Neon branch `UAT` (project `ScoringApp`, id `patient-morning-97818497`) | Copy-on-write off `production`. No auto-refresh policy yet — reset with `neonctl branches reset UAT --parent` when data drifts too far from useful. |
| Redis | Upstash `ScoreHub-UAT` (pay-as-you-go, `ap-southeast-2`) | Deliberately a separate database from prod's `ScoreHub` — isolates the Socket.io cross-instance adapter and clock tick-lock so UAT traffic can't touch prod's Redis keyspace. |
| Object storage | R2 bucket `scorehub-uat`, custom domain `cdn-uat.scorehub.co.nz` | Access key scoped to this bucket only (Object Read & Write), created via the Cloudflare dashboard (not available through `wrangler`/the account API token used for other Cloudflare ops). Account ID `c0c396b5f4c3cf71c2ecb3821febaf92`. |
| Marketing site | Cloudflare Worker `scorehub-marketing-uat`, custom domain `uat.scorehub.co.nz` | Deploy: `cd marketing && npm run build && npx wrangler deploy --env uat`. Manual only, no CI job. Uses a Mailgun sandbox domain and routes contact-form submissions to `sam@samcorp.co.nz` instead of `hello@scorehub.co.nz` — see the `uat` env block in `marketing/wrangler.jsonc`. **Custom domain not yet live** — see "Known gaps". |
| Help centre | Cloudflare Worker `scorehub-help-uat`, custom domain `help.uat.scorehub.co.nz` | Deploy: `cd help && npm run build && npx wrangler deploy --env uat`. Manual only, no CI job. |

UAT hostnames mirror production's structure — bare domain is marketing, `app.` is the frontend, `help.` is the help centre — just with everything nested a level under `uat.`: `uat.scorehub.co.nz` (marketing), `app.uat.scorehub.co.nz` (frontend), `help.uat.scorehub.co.nz` (help centre).

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

- **UAT subdomain scheme changed on 2026-08-15** — from `marketing-uat`/`help-uat`/bare-`uat`
  (app) to the current `uat.` (marketing) / `app.uat.` / `help.uat.` scheme, to mirror prod's
  bare-domain/`app.`/`help.` structure. This left two loose ends:
  - **Stale `uat.scorehub.co.nz` DNS record**: `uat.scorehub.co.nz` was originally registered for
    the *frontend* (a Vercel CNAME to `561d756e4f5b917f.vercel-dns-016.com`, added by hand
    following the old scheme's instructions). Now that `uat.scorehub.co.nz` is meant for
    *marketing* instead, that CNAME needs to be **deleted** from the Cloudflare dashboard for the
    `scorehub.co.nz` zone before the marketing Worker's custom domain can attach —
    `wrangler deploy --env uat` for `marketing/` will fail with `Hostname 'uat.scorehub.co.nz'
    already has externally managed DNS records` until it's gone. Once deleted, re-run
    `cd marketing && npx wrangler deploy --env uat` to provision the correct record automatically
    (same mechanism that already worked for `help.uat.scorehub.co.nz`).
  - **`app.uat.scorehub.co.nz` DNS record**: `vercel domains add app.uat.scorehub.co.nz
    scoring-app` has registered the new hostname on the project, but as with the old one, the
    Cloudflare API token used for `wrangler` only has `zone:read`, not DNS-record write — add by
    hand: `A app.uat.scorehub.co.nz 76.76.21.21` (**DNS only**, not proxied through Cloudflare's
    orange cloud, so Vercel can issue its own TLS cert). Then run
    `vercel domains verify app.uat.scorehub.co.nz`.
  - **`app.uat.scorehub.co.nz` branch targeting**: once DNS resolves, the domain still defaults to
    serving the project's **Production** deployment, not the `uat` branch. In the Vercel
    dashboard, go to `scoring-app` → Settings → Domains → `app.uat.scorehub.co.nz` and assign it
    to Git Branch `uat` (no CLI/API path for this was found — it's dashboard-only). Until that's
    done, use the branch-alias URL above for testing instead.
  - **Cleanup**: the old `uat.scorehub.co.nz` domain attachment on the `scoring-app` Vercel
    project is now unused (its DNS was repointed to marketing above) and can be removed via the
    dashboard — `vercel domains rm` only operates on top-level domains and can't touch a
    project-attached subdomain, so this is dashboard-only too.
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
