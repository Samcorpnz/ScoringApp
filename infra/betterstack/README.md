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

1. **Sentry -> status page alerting** — Better Stack's one-click "native" Sentry integration
   (Integrations -> Sentry, OAuth-connect) sits behind a paid plan; confirmed 2026-08-24. Use
   the free path instead, which reaches the same outcome (a Sentry error spike posts a status
   page incident) via two dashboard-only steps neither Terraform nor this repo's tooling can
   automate:

   * **Better Stack** — Integrations -> Importing data -> add **Incoming webhook** (free, core
     Incident Management, not the gated marketplace connector). Copy its unique webhook URL.
     Configure an incident-creation rule matching Sentry's webhook payload (e.g.
     `action: "triggered"` or `level: "error"`), mapping `title`/`culprit` to the incident
     title/cause.
   * **Sentry** — Settings -> Developer Settings -> New Internal Integration (free on any
     plan). Enable "Alert Rule Action", set its webhook URL to the Better Stack incoming
     webhook URL above. Add that integration as an action on the existing "Send a notification
     for high priority issues" alert rules for `scorehub-relay` and `scorehub-frontend`.
2. **On-call (Phase 3 / SA-110)** — not set up yet. Defer until SA-110.

## Later phases

- **SA-109** — internal `/health/deep` route (Neon/Upstash reachability) is not on this status
  page; it's an internal signal, not public.
- **SA-111** — marketing/help/downloads Workers monitors and a custom status domain aren't in
  this config yet; add `betteruptime_monitor` + `betteruptime_status_page_resource` pairs for
  each Worker when that phase starts.
