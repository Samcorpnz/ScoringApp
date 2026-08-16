terraform {
  required_version = ">= 1.5"

  required_providers {
    betteruptime = {
      source  = "BetterStackHQ/better-uptime"
      version = "~> 0.21"
    }
  }
}

# Auth via BETTERUPTIME_API_TOKEN env var (Better Stack dashboard ->
# Settings -> API tokens) rather than a provider block argument, so the
# token never lands in state or a .tf file.
provider "betteruptime" {}
