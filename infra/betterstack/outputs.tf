output "status_page_url" {
  value = "https://${var.status_page_subdomain}.betteruptime.com"
}

output "relay_monitor_id" {
  value = betteruptime_monitor.relay_health.id
}

output "frontend_monitor_id" {
  value = betteruptime_monitor.frontend_health.id
}
