# Better Stack (SA-48, Phase 1)

Terraform for the three uptime monitors (relay `/health`, frontend `/api/health`, and a
synthetic Sentry error-rate check) and the public status page. Not part of the npm workspace
or the `deploy.yml` pipeline — apply by hand.

## Apply

```bash
cd infra/betterstack
export BETTERUPTIME_API_TOKEN=...   # Better Stack dashboard -> Settings -> API tokens
terraform init
terraform plan
terraform apply
```

## Steps Terraform doesn't cover

Better Stack's provider doesn't expose these as resources — do them once in the dashboard
after `apply`:

1. **Sentry -> status page alerting** — Better Stack's *entire* "Importing data" section
   (both the one-click native Sentry connector AND generic Incoming Webhooks/Email
   integrations) sits behind a paid Responder license ($9-34/mo per person) on the plan this
   account is on; confirmed 2026-08-24 by hitting the billing wall on Incoming Webhooks too,
   not just the Sentry app specifically. There is no free way to push Sentry alerts into
   Better Stack's Incident Management.

   Free workaround instead: `betteruptime_monitor.sentry_error_rate` (this config) polls
   `frontend/app/api/health/sentry-error-rate`, a route that queries Sentry's own API for
   recent error volume and returns 503 when it's over threshold. Ordinary uptime monitors
   *are* free, so a Sentry-side spike still shows up on the status page — just via polling
   (one `check_frequency_seconds` cycle of latency) instead of an instant push. Requires a
   `SENTRY_ERROR_MONITOR_TOKEN` env var on the frontend deployment (org:read + project:read +
   event:read scope — see `frontend/.env.example`); the route fails open (reports ok) if the
   token is unset or the Sentry query fails, so a misconfiguration here never manufactures a
   false incident.
2. **On-call (Phase 3 / SA-110)** — also part of Incident Management, so likely hits the same
   paid-plan wall. Re-confirm cost/scope when SA-110 is picked up rather than assuming.

## Later phases

- **SA-109** — internal `/health/deep` route (Neon/Upstash reachability) is not on this status
  page; it's an internal signal, not public.
- **SA-111** — marketing/help/downloads Workers monitors and a custom status domain aren't in
  this config yet; add `betteruptime_monitor` + `betteruptime_status_page_resource` pairs for
  each Worker when that phase starts.
