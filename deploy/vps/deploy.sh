#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:-/opt/hobbysalon}"
compose_dir="$repo_dir/deploy/vps"

if [[ ! -f "$compose_dir/.env" ]]; then
  echo "Missing $compose_dir/.env"
  echo "Create it from $compose_dir/.env.example before deploying."
  exit 1
fi

cd "$repo_dir"
git pull --ff-only

cd "$compose_dir"
docker compose build backend
docker compose up -d
docker compose ps

install -m 644 \
  "$compose_dir/nginx-api.hobbysalon.be.conf" \
  /etc/nginx/sites-available/api.hobbysalon.be
ln -sfn \
  /etc/nginx/sites-available/api.hobbysalon.be \
  /etc/nginx/sites-enabled/api.hobbysalon.be
nginx -t
systemctl reload nginx
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "${BACKEND_DOMAIN:-api.hobbysalon.be}" --non-interactive --redirect || true
fi
