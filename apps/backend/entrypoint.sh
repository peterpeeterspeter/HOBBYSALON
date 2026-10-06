#!/bin/sh
set -eu
# Medusa CLI configstore needs writable config even with a read-only image/home.
# Ignore caller-selected config paths; this process owns a private /tmp directory.
umask 077
XDG_CONFIG_HOME=$(mktemp -d /tmp/medusa-release-config.XXXXXX)
export XDG_CONFIG_HOME
export MEDUSA_TELEMETRY_DISABLED=true
trap 'rm -rf "$XDG_CONFIG_HOME"' EXIT
# Never perform migrations, seeds, or arbitrary shell commands during normal startup.
command=${1:-start}
if [ "$#" -gt 0 ]; then shift; fi
[ "$#" -eq 0 ] || { printf '%s\n' 'release commands take no arguments' >&2; exit 64; }
case "$command" in
  start)
    cd /app/apps/backend/.medusa/server
    [ -f medusa-config.js ] || { printf '%s\n' 'Compiled config is missing' >&2; exit 78; }
    # Direct compiled CLI: cli.js would register ts-node even in production.
    exec node /app/node_modules/@medusajs/cli/dist/index.js start --types=false --host 0.0.0.0 --port "${PORT:-9000}"
    ;;
  migrate)
    [ "${RELEASE_MIGRATION_APPROVED:-}" = 'yes' ] || { printf '%s\n' 'Migration blocked: explicit RELEASE_MIGRATION_APPROVED=yes required' >&2; exit 78; }
    image_source=$(cat /release/source.sha256)
    [ "${#image_source}" -eq 64 ] || { printf '%s\n' 'Invalid baked source hash' >&2; exit 78; }
    case "$image_source" in *[!0-9a-f]*) printf '%s\n' 'Invalid baked source hash' >&2; exit 78 ;; esac
    [ "${RELEASE_MIGRATION_SOURCE_SHA256:-}" = "$image_source" ] || { printf '%s\n' 'Migration blocked: approved source hash must match baked image receipt' >&2; exit 78; }
    cd /app/apps/backend/.medusa/server
    [ -f medusa-config.js ] || { printf '%s\n' 'Compiled config is missing' >&2; exit 78; }
    # Never execute destructive links or app/provider migration scripts implicitly.
    case "${RELEASE_MIGRATE_LINKS:-skip}" in
      skip|safe) ;;
      *) printf '%s\n' 'Migration blocked: only skip or safe link policy is permitted' >&2; exit 78 ;;
    esac
    case "${RELEASE_MIGRATE_SCRIPTS:-skip}" in
      skip) ;;
      approved)
        [ "${RELEASE_MIGRATION_SCRIPTS_APPROVED:-}" = 'yes' ] || { printf '%s\n' 'Migration scripts blocked: separate RELEASE_MIGRATION_SCRIPTS_APPROVED=yes required' >&2; exit 78; }
        ;;
      *) printf '%s\n' 'Migration blocked: only skip or approved script policy is permitted' >&2; exit 78 ;;
    esac
    [ -f /app/deploy/release/migrate-native.cjs ] && [ -f /app/deploy/release/migration-plan.cjs ] || { printf '%s\n' 'Native release migration runner is missing from image' >&2; exit 78; }
    exec node /app/deploy/release/migrate-native.cjs
    ;;
  *) printf '%s\n' 'Allowed commands: start, migrate (explicitly gated)' >&2; exit 64 ;;
esac
