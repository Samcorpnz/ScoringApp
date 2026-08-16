# Phase 1 of the monitoring rollout (Jira SA-48): uptime monitors for relay
# and frontend, plus a public status page surfacing both. Deep dependency
# checks, on-call escalation, and Workers coverage are later phases
# (SA-109/SA-110/SA-111) — see project memory "monitoring rollout".

resource "betteruptime_monitor" "relay_health" {
  monitor_type        = "status"
  url                 = var.relay_health_url
  pronounceable_name  = "ScoreHub relay"
  check_frequency     = var.check_frequency_seconds
  request_timeout     = 15
  recovery_period     = 60
  confirmation_period = 60
  email               = true
  push                = true
  sms                 = false
  call                = false
}

resource "betteruptime_monitor" "frontend_health" {
  monitor_type        = "status"
  url                 = var.frontend_health_url
  pronounceable_name  = "ScoreHub web app"
  check_frequency     = var.check_frequency_seconds
  request_timeout     = 15
  recovery_period     = 60
  confirmation_period = 60
  email               = true
  push                = true
  sms                 = false
  call                = false
}

resource "betteruptime_status_page" "main" {
  company_name = "ScoreHub"
  company_url  = "https://scorehub.co.nz"
  subdomain    = var.status_page_subdomain
  timezone     = "Pacific/Auckland"
}

resource "betteruptime_status_page_resource" "relay" {
  status_page_id = betteruptime_status_page.main.id
  resource_id    = betteruptime_monitor.relay_health.id
  resource_type  = "Monitor"
  public_name    = "Live scoring (relay)"
}

resource "betteruptime_status_page_resource" "frontend" {
  status_page_id = betteruptime_status_page.main.id
  resource_id    = betteruptime_monitor.frontend_health.id
  resource_type  = "Monitor"
  public_name    = "Web app"
}
