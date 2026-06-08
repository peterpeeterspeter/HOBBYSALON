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
