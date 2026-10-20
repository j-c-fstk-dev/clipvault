#!/usr/bin/env bash
# Starts a packaged ClipVault on a virtual X server with an empty profile and
# checks that it opens its history and starts capturing the clipboard.
# Usage: scripts/smoke-test.sh <command> [args...]   (needs xvfb-run)
set -euo pipefail

profile=$(mktemp -d)
trap 'rm -rf "$profile"' EXIT
log="$profile/smoke.log"

HOME="$profile" XDG_CONFIG_HOME="$profile/.config" XDG_DATA_HOME="$profile/.local/share" \
  timeout 20 xvfb-run -a "$@" >"$log" 2>&1 || true

if grep -q "clipboard capture started" "$log" &&
  [ -f "$profile/.local/share/com.jorgecristo.clipvault/clipvault.db" ]; then
  echo "smoke test passed: $*"
else
  echo "smoke test FAILED: $*" >&2
  cat "$log" >&2
  exit 1
fi
