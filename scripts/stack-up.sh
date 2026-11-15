#!/usr/bin/env bash
# Start the E2E stack: backend on :4000 and the frontend preview build on :3000,
# both against the bomberman-e2e database. MongoDB must already run
# (locally `make db` in the workspace root; in CI a service container).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$(cd "${FRONTEND_DIR:-$ROOT/../Bomberman-2.0}" && pwd)"
BACKEND_DIR="$(cd "${BACKEND_DIR:-$ROOT/../Bomberman-2.0-Backend}" && pwd)"
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017/bomberman-e2e}"
STACK_DIR="$ROOT/.stack"

case "$MONGO_URL" in
  mongodb://localhost:* | mongodb://127.0.0.1:*) ;;
  *)
    echo "stack-up: MONGO_URL must point to a local MongoDB, got $MONGO_URL" >&2
    exit 1
    ;;
esac

for port in 3000 4000; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "stack-up: port $port is in use; stop make dev first" >&2
    exit 1
  fi
done

mkdir -p "$STACK_DIR"

install_deps() {
  if [ -n "${CI:-}" ] || [ ! -d "$1/node_modules" ]; then
    (cd "$1" && HUSKY=0 npm ci)
  fi
}

echo "stack-up: backend ($BACKEND_DIR)"
install_deps "$BACKEND_DIR"
(cd "$BACKEND_DIR" && npm run build)

echo "stack-up: drop the bomberman-e2e database"
(cd "$BACKEND_DIR" && MONGO_URL="$MONGO_URL" node -e '
  const mongoose = require("mongoose");
  mongoose
    .connect(process.env.MONGO_URL)
    .then(c => c.connection.dropDatabase())
    .then(() => mongoose.disconnect())
    .catch(e => { console.error(e); process.exit(1); });
')

(
  cd "$BACKEND_DIR"
  DB_HOST="$MONGO_URL" PORT=4000 CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= \
    CLOUDINARY_API_SECRET= nohup node dist/app.js >"$STACK_DIR/backend.log" 2>&1 &
  echo $! >"$STACK_DIR/backend.pid"
)

echo "stack-up: frontend ($FRONTEND_DIR)"
install_deps "$FRONTEND_DIR"
(
  cd "$FRONTEND_DIR"
  VITE_E2E=true VITE_SERVER_BASE_URL=http://localhost:4000 \
    VITE_CLIENT_ID=e2e-placeholder npm run build
)
(
  cd "$FRONTEND_DIR"
  nohup npx vite preview --config vite/config.prod.mjs --port 3000 --strictPort \
    >"$STACK_DIR/frontend.log" 2>&1 &
  echo $! >"$STACK_DIR/frontend.pid"
)

bash "$ROOT/scripts/wait-for-stack.sh"
