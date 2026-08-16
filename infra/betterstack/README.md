# Better Stack (SA-48, Phase 1)

Terraform for the two uptime monitors (relay `/health`, frontend `/api/health`) and the
public status page. Not part of the npm workspace or the `deploy.yml` pipeline — apply by hand.

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

1. **Sentry integration** — Integrations -> Sentry, OAuth-connect the same Sentry org already
   wired into frontend/relay/bridge. Routes Sentry alerts into Better Stack alongside the
   uptime monitors.
2. **On-call (Phase 3 / SA-110)** — not set up yet. Defer until SA-110.

## Later phases

- **SA-109** — internal `/health/deep` route (Neon/Upstash reachability) is not on this status
  page; it's an internal signal, not public.
- **SA-111** — marketing/help/downloads Workers monitors and a custom status domain aren't in
  this config yet; add `betteruptime_monitor` + `betteruptime_status_page_resource` pairs for
  each Worker when that phase starts.
