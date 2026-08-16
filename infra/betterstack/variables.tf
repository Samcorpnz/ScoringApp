variable "relay_health_url" {
  description = "Relay's shallow liveness endpoint (SA-29) — same one Fly's own healthcheck polls."
  type        = string
  default     = "https://scorehub-relay.fly.dev/health"
}

variable "frontend_health_url" {
  description = "Frontend's liveness endpoint (SA-48, frontend/app/api/health)."
  type        = string
  default     = "https://app.scorehub.co.nz/api/health"
}

variable "status_page_subdomain" {
  description = "Subdomain under betteruptime.com for Phase 1 (custom domain deferred to SA-111)."
  type        = string
  default     = "scorehub"
}

variable "check_frequency_seconds" {
  description = "How often Better Stack polls each monitor."
  type        = number
  default     = 30
}
