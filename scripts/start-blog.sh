#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-4321}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"
MIN_NODE_MAJOR=22
REQUIRED_PNPM_VERSION=9.14.4
CODEX_PNPM="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm"

info() {
  printf '\033[1;34m==>\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33mWARN:\033[0m %s\n' "$1" >&2
}

fail() {
  printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

find_pnpm() {
  if command_exists pnpm; then
    command -v pnpm
    return 0
  fi

  if [ -x "$CODEX_PNPM" ]; then
    printf '%s\n' "$CODEX_PNPM"
    return 0
  fi

  return 1
}

port_is_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

sync_pagefind_for_dev() {
  if [ ! -f dist/pagefind/pagefind.js ]; then
    info "Pagefind index not found. Building the site once to generate local search index."
    if ! "$PNPM_BIN" build; then
      warn "Could not generate Pagefind index. The blog will still start, but local search results may be unavailable."
      return 0
    fi
  fi

  if [ -f dist/pagefind/pagefind.js ]; then
    info "Syncing Pagefind index for local dev search."
    rm -rf public/pagefind
    cp -R dist/pagefind public/pagefind
  else
    warn "Pagefind index not found. Local search results will be unavailable."
  fi
}

pick_port() {
  local candidate="$1"

  if ! port_is_busy "$candidate"; then
    printf '%s\n' "$candidate"
    return 0
  fi

  warn "Port $candidate is already in use."

  for candidate in $(seq "$((PORT + 1))" "$((PORT + 10))"); do
    if ! port_is_busy "$candidate"; then
      warn "Using free port $candidate instead."
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  fail "No free port found from $PORT to $((PORT + 10)). Set PORT=xxxx and try again."
}

info "Starting Firefly-Mod blog from $ROOT_DIR"

command_exists node || fail "Node.js is not installed. Please install Node.js $MIN_NODE_MAJOR or newer."

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node.js $MIN_NODE_MAJOR or newer is required. Current version: $(node --version)"
fi

if ! PNPM_BIN="$(find_pnpm)"; then
  if command_exists corepack; then
    info "pnpm was not found. Enabling it with Corepack."
    corepack enable
    PNPM_BIN="$(find_pnpm)" || fail "pnpm is still not available after running Corepack."
  elif command_exists npm; then
    info "pnpm was not found. Installing pnpm@$REQUIRED_PNPM_VERSION with npm."
    npm install -g "pnpm@$REQUIRED_PNPM_VERSION"
    hash -r
    PNPM_BIN="$(find_pnpm)" || fail "pnpm is still not available after npm install."
  else
    fail "pnpm is not installed and npm/corepack are unavailable. Install pnpm 9 or newer, then run this script again."
  fi
fi

if [ ! -d node_modules ]; then
  info "Installing dependencies with pnpm."
  "$PNPM_BIN" install --frozen-lockfile
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  info "Creating local .env from .env.example."
  cp .env.example .env
fi

sync_pagefind_for_dev

PORT="$(pick_port "$PORT")"

info "Local URL: http://localhost:$PORT"
info "Network URL: http://$(ipconfig getifaddr en0 2>/dev/null || printf '127.0.0.1'):$PORT"

if [ "$OPEN_BROWSER" != "0" ]; then
  exec "$PNPM_BIN" dev --host "$HOST" --port "$PORT" --open
fi

exec "$PNPM_BIN" dev --host "$HOST" --port "$PORT"
