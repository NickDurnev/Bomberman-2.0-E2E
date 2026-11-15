#!/usr/bin/env bash
# Wait until the backend (:4000) and the frontend (:3000) answer HTTP.
set -euo pipefail

TIMEOUT="${STACK_TIMEOUT:-120}"
STACK_DIR="$(cd "$(dirname "$0")/.." && pwd)/.stack"

for url in http://localhost:4000 http://localhost:3000; do
  start=$(date +%s)
  until curl -s -o /dev/null "$url"; do
    if [ $(($(date +%s) - start)) -ge "$TIMEOUT" ]; then
      echo "wait-for-stack: $url did not answer in ${TIMEOUT}s" >&2
      tail -n 30 "$STACK_DIR"/*.log >&2 || true
      exit 1
    fi
    sleep 1
  done
  echo "wait-for-stack: $url is up"
done
