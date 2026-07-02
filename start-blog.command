#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/Library/pnpm:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:${PNPM_HOME:-}:$PATH"

if [ -n "${TERM:-}" ]; then
  clear
fi
printf 'Starting Firefly-Mod blog...\n\n'

bash "$SCRIPT_DIR/scripts/start-blog.sh"
status=$?

if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  printf '\nStartup failed with exit code %s.\n' "$status"
  printf 'Press Enter to close this window...'
  read -r _
fi

exit "$status"
