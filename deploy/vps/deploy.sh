#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'Deployment refused: %s\n' "$*" >&2; exit 1; }
repo_dir="${1:-/opt/hobbysalon}"

# Approval and identity errors must precede any deployment mutation. Never pull
# an arbitrary branch tip: the operator prepares the reviewed checkout separately.
[[ "${DEPLOY_APPROVED:-}" == true ]] || fail 'DEPLOY_APPROVED=true is required'
[[ "${EXPECTED_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] || fail 'EXPECTED_COMMIT must be the full approved commit'
[[ "${COMMERCE_PAYMENTS_ENABLED:-false}" == false ]] || fail 'Initial rollout requires payments paused'
[[ "${COMMERCE_PAYOUTS_ENABLED:-false}" == false ]] || fail 'Initial rollout requires payouts paused'
# Explicit exports override dotenv/env_file values, including previously enabled
# production settings. Enabling commerce is a separate approved procedure.
export EXPECTED_COMMIT COMMERCE_PAYMENTS_ENABLED=false COMMERCE_PAYOUTS_ENABLED=false
for cmd in git tar mktemp rm docker install ln nginx systemctl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Missing prerequisite: $cmd"
done
cd "$repo_dir"
repo_dir="$PWD"
[[ "$(git rev-parse --show-toplevel)" == "$repo_dir" ]] || fail 'Expected repository root'
[[ "$(git rev-parse HEAD)" == "$EXPECTED_COMMIT" ]] || fail 'HEAD differs from approved commit'
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail 'Tracked source must be clean'
commit_tree="$(git ls-tree -r "$EXPECTED_COMMIT")"
# Split at Git's metadata/path tab, never on whitespace inside a path. Quoted
# unusual paths deliberately cannot match the sole allowed .claude/ prefix.
while IFS= read -r tree_entry; do
  [[ -n "$tree_entry" ]] || continue
  [[ "$tree_entry" == *$'\t'* ]] || fail 'Malformed approved tree entry'
  tree_metadata="${tree_entry%%$'\t'*}"
  tree_path="${tree_entry#*$'\t'}"
  if [[ "$tree_metadata" == '160000 '* ]]; then
    [[ "$tree_metadata" =~ ^160000\ commit\ [0-9a-f]{40}$ && "$tree_path" == .claude/* && "$tree_path" != *$'\t'* ]] || fail 'Gitlinks/submodules outside unquoted .claude/ paths are unsupported in approved build context'
  fi
done <<< "$commit_tree"
compose_dir="$repo_dir/deploy/vps"
[[ -f "$compose_dir/.env" ]] || fail 'Missing Compose .env; configure separately'
[[ -f "$compose_dir/compose.yaml" && -f "$compose_dir/nginx-api.hobbysalon.be.conf" ]] || fail 'Missing deployment files'
cd "$compose_dir"
docker compose version >/dev/null
wait_help="$(docker compose up --help)"
[[ "$wait_help" == *--wait-timeout* ]] || fail 'Compose with --wait and --wait-timeout is required'
docker compose config --quiet
nginx -t

require_healthy() {
  local service="$1" id state
  id="$(docker compose ps -q "$service")"
  [[ -n "$id" && "$id" != *$'\n'* ]] || fail "Expected one existing $service container"
  state="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$id")"
  [[ "$state" == 'running healthy' ]] || fail "$service is not running and healthy"
  healthy_id="$id"
}
# Do NOT create/recreate dependencies: the manifest's PostgreSQL 17 declaration
# is not authority to upgrade the existing production PostgreSQL 16 data volume.
require_healthy postgres
require_healthy redis

# Never let COPY . consume the live worktree (including ignored/untracked source
# or operator credentials). Fixed /tmp base deliberately ignores repo-local TMPDIR.
build_context="$(mktemp -d /tmp/hobbysalon-approved-build.XXXXXXXX)"
trap 'rm -rf -- "$build_context"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
[[ "$build_context" != "$repo_dir" && "$build_context" != "$repo_dir/"* ]] || fail 'Build context must be outside repository'
git -C "$repo_dir" archive --format=tar "$EXPECTED_COMMIT" | tar --exclude=.claude -xf - -C "$build_context"
[[ -f "$build_context/apps/backend/Dockerfile" ]] || fail 'Approved archive lacks backend Dockerfile'
image_ref="hobbysalon-backend:$EXPECTED_COMMIT"
docker build --label "org.opencontainers.image.revision=$EXPECTED_COMMIT" \
  --tag "$image_ref" -f "$build_context/apps/backend/Dockerfile" "$build_context"
image_identity="$(docker image inspect --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_ref")"
read -r built_image built_revision <<< "$image_identity"
[[ "$built_image" == sha256:* && "$built_revision" == "$EXPECTED_COMMIT" ]] || fail 'Built artifact revision does not match approval'
docker compose up -d --no-deps --no-build --wait --wait-timeout 300 backend
require_healthy backend
running_image="$(docker inspect --format '{{.Image}}' "$healthy_id")"
[[ "$running_image" == "$built_image" ]] || fail 'Running backend differs from built artifact'

# Only verified backend readiness permits ingress/TLS changes.
install -m 644 \
  "$compose_dir/nginx-api.hobbysalon.be.conf" \
  /etc/nginx/sites-available/api.hobbysalon.be
ln -sfn \
  /etc/nginx/sites-available/api.hobbysalon.be \
  /etc/nginx/sites-enabled/api.hobbysalon.be
nginx -t
systemctl reload nginx
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "${BACKEND_DOMAIN:-api.hobbysalon.be}" --non-interactive --redirect
fi
printf 'Deployment succeeded: commit %s image %s (backend healthy; commerce paused)\n' "$EXPECTED_COMMIT" "$built_image"
