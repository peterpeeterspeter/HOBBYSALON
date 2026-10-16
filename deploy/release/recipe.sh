#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
command=${1:-verify}
if [ "$#" -gt 0 ]; then shift; fi
[ "$#" -eq 0 ] || { printf '%s\n' 'recipe takes one command only' >&2; exit 64; }
case "$command" in
  verify)
    sh -n apps/backend/entrypoint.sh
    sh -n deploy/release/recipe.sh
    node --check deploy/release/audit-dependencies.cjs
    node --check deploy/release/archive-runtime.cjs
    node --check deploy/release/verify-offline.cjs
    node deploy/release/verify-offline.cjs
    node deploy/release/audit-dependencies.cjs preflight "$root"
    ;;
  build)
    # This task did NOT execute this branch. A separate, resourced worker must.
    [ "${RELEASE_BUILD_APPROVED:-}" = 'yes' ] || { printf '%s\n' 'Build blocked: RELEASE_BUILD_APPROVED=yes required' >&2; exit 78; }
    node deploy/release/audit-dependencies.cjs preflight "$root"
    : "${RELEASE_IMAGE_TAG:?Set a new candidate-only image tag}"
    case "$RELEASE_IMAGE_TAG" in hobbysalon-release-candidate:*) ;; *) printf '%s\n' 'Candidate-only image tag required' >&2; exit 78 ;; esac
    DOCKER_BUILDKIT=1 docker build --pull --progress=plain --file apps/backend/Dockerfile --tag "$RELEASE_IMAGE_TAG" .
    ;;
  *) printf '%s\n' 'Allowed: verify, build (explicitly gated; never deploys or migrates)' >&2; exit 64 ;;
esac