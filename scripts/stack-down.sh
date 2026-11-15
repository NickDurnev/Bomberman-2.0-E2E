#!/usr/bin/env bash
# Stop the processes that stack-up.sh started.
set -uo pipefail

STACK_DIR="$(cd "$(dirname "$0")/.." && pwd)/.stack"

for name in frontend backend; do
  pidfile="$STACK_DIR/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null && echo "stack-down: stopped $name ($pid)"
    rm -f "$pidfile"
  fi
done
