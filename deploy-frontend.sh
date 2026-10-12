#!/usr/bin/env bash
# Deploys the frontend on the VPS: pull, install, build, (re)start with PM2.
# Stops at the first error; a failed build never reaches the restart step,
# so PM2 keeps serving the previous build's process.
set -Eeuo pipefail

APP_NAME="contrast-frontend"
PORT=3000

cd "$(dirname "$(readlink -f "$0")")"
trap 'echo "✗ Deploy failed (line $LINENO). Nothing was restarted." >&2' ERR

step() { printf '\n==> %s\n' "$*"; }

step "Checking prerequisites"
for tool in git node npm pm2 curl; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
node -e 'const [maj,min]=process.versions.node.split(".").map(Number); if (maj<20||(maj===20&&min<9)) { console.error("Node >= 20.9 required, found "+process.versions.node); process.exit(1) }'

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production — copy .env.production.example and fill it in." >&2
  exit 1
fi
if ! grep -Eq '^NEXT_PUBLIC_API_(BASE_)?URL=https://' .env.production; then
  echo ".env.production must set NEXT_PUBLIC_API_BASE_URL (or NEXT_PUBLIC_API_URL) to an https URL." >&2
  exit 1
fi
if ! grep -Eq '^NEXT_PUBLIC_DEMO_MODE=false' .env.production; then
  echo ".env.production must set NEXT_PUBLIC_DEMO_MODE=false (otherwise the shop shows sample data)." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "There are uncommitted changes to tracked files on this server. Commit or discard them first:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

step "Pulling latest code ($(git rev-parse --abbrev-ref HEAD))"
git pull --ff-only

step "Installing dependencies"
# Dev dependencies (TypeScript, Tailwind) are needed to build.
npm ci --include=dev

step "Building"
npm run build

step "Starting / restarting $APP_NAME"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$APP_NAME"
fi
pm2 save

step "Health check"
for attempt in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "✓ $APP_NAME is up on 127.0.0.1:${PORT} ($(git rev-parse --short HEAD))"
    exit 0
  fi
  sleep 1
done
echo "✗ $APP_NAME did not respond on port ${PORT}. Check: pm2 logs $APP_NAME" >&2
exit 1
