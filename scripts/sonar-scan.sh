#!/usr/bin/env bash
# Runs sonar-scanner against the local SonarQube instance
# (docker-compose.sonarqube.yml), pulling SONAR_TOKEN from .env so it never
# needs to be typed or committed. Used by `npm run scan:sonar` and the
# pre-push hook (scripts/install-git-hooks.sh).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "SONAR_TOKEN not set — add it to .env (see .env.example)." >&2
  exit 1
fi

if ! curl -s -o /dev/null -w '' "${SONAR_HOST_URL:-http://localhost:9000}/api/system/status" 2>/dev/null; then
  echo "SonarQube not reachable at ${SONAR_HOST_URL:-http://localhost:9000} — start it with:" >&2
  echo "  docker compose -f docker-compose.sonarqube.yml up -d" >&2
  exit 1
fi

# Regenerate lcov reports so sonar.javascript.lcov.reportPaths (see
# sonar-project.properties) has fresh data — otherwise coverage-based gate
# conditions compare against a stale or missing report.
npm run test:coverage --workspace=frontend
npm run test:coverage --workspace=relay
npm run test:coverage --workspace=bridge

exec sonar-scanner -Dsonar.token="$SONAR_TOKEN"
