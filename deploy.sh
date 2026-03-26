#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/vizcanvas"
BRANCH="${1:-main}"
SERVICE="vizcanvas"

echo "==> Deploying ${APP_DIR} from branch ${BRANCH}"

cd "${APP_DIR}"

echo "==> Pulling latest changes"
git pull origin "${BRANCH}"

echo "==> Installing dependencies"
npm ci

echo "==> Running production build"
npm run build

echo "==> Restarting service: ${SERVICE}"
systemctl restart "${SERVICE}"

echo "==> Service status"
systemctl status "${SERVICE}" --no-pager

echo "==> Deploy complete"
