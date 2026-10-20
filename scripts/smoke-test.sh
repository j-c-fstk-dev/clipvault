#!/usr/bin/env bash
# Starts a packaged ClipVault on a virtual X server with an empty profile and
# checks that it opens its history and starts capturing the clipboard.
# Usage: scripts/smoke-test.sh <command> [args...]   (needs xvfb-run)
set -euo pipefail

TIMEOUT_SECONDS=${SMOKE_TIMEOUT:-30}
profile=$(mktemp -d)
log="$profile/smoke.log"

# In its own process group, so that it can be stopped together with the X
# server and WebKit helpers it starts.
HOME="$profile" XDG_CONFIG_HOME="$profile/.config" XDG_DATA_HOME="$profile/.local/share" \
  RUST_LOG="${RUST_LOG:-clipvault_lib=debug,tauri=debug}" \
  setsid xvfb-run -a "$@" >"$log" 2>&1 &
runner=$!

passed=false
for _ in $(seq $((TIMEOUT_SECONDS * 2))); do
  if grep -q "clipboard capture started" "$log" &&
    [ -f "$profile/.local/share/com.jorgecristo.clipvault/clipvault.db" ]; then
    passed=true
    break
  fi
  kill -0 "$runner" 2>/dev/null || break
  sleep 0.5
done

if ! $passed; then
  echo "smoke test FAILED: $*" >&2
  echo "--- processes (still running = where it is stuck)" >&2
  ps -eo pid,ppid,stat,wchan:24,etime,args | grep -iE "clipvault|webkit|xvfb" | grep -v grep >&2 || true
  echo "--- output" >&2
  cat "$log" >&2
fi

kill -TERM -- "-$runner" 2>/dev/null || true
wait "$runner" 2>/dev/null || true
sleep 1
kill -KILL -- "-$runner" 2>/dev/null || true
rm -rf "$profile"

$passed && echo "smoke test passed: $*"
