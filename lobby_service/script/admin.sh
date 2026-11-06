#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
if [[ "${1:-}" == "bootstrap" ]]; then
  if [[ -z "${LOBBY_ADMIN_USERNAME:-}" ]]; then
    read -r -p 'Administrator username: ' LOBBY_ADMIN_USERNAME
  fi
  if [[ -z "${LOBBY_ADMIN_PASSWORD:-}" ]]; then
    read -r -s -p 'Password (14-72 bytes): ' LOBBY_ADMIN_PASSWORD
    printf '\n'
  fi
  export LOBBY_ADMIN_USERNAME LOBBY_ADMIN_PASSWORD
fi
exec go run ./app/apis/lobby/api/admin "$@"
