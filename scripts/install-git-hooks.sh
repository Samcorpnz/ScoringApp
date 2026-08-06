#!/usr/bin/env bash
# Installs local git hooks. .git/hooks isn't tracked by git, so this script
# is what actually makes scripts/git-hooks/* effective — run it once after
# cloning. Opt-in and per-machine on purpose: these hooks assume tooling
# (e.g. a SONAR_TOKEN for the shared sonar.samcorp.co.nz instance) that not
# every contributor has configured.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
hooks_src="$repo_root/scripts/git-hooks"
hooks_dst="$repo_root/.git/hooks"

for hook in "$hooks_src"/*; do
  name="$(basename "$hook")"
  cp "$hook" "$hooks_dst/$name"
  chmod +x "$hooks_dst/$name"
  echo "Installed $name"
done
