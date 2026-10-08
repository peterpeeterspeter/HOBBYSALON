# Local-only exact-main candidate build inputs

This orphan input branch contains six files only. It contains no application source,
legacy workflows, production environment, deploy command, registry credential or DB access.
Authoring does NOT publish the branch, commit, run a hosted job, build an image or deploy.
The parent must independently review all inputs before any separately authorized publication.

## Immutable source

- Squash-merged main commit: `f105b2fc1421320edc8860c8419fb2ec5c8aba43`.
- Tree: `18e56de6c8f39dbc231c91766ce3c01fe7103a67` (matches tested head `794f8d266b60fbc9258e1da6cea1eaf791e9bce8`).
- Full-source snapshot (existing audit-dependencies snapshot algorithm, all repository roots, 3886 included files): `ca62f61071258d2e0d83cea34f4cbc754db251e9f1fe55441c9c47a612c52d6f`.
- Dockerfile: `155ef12fc5094994bf057d7c2a44f62b571821b8d4089e1c9e177e015292abb7`.
- Root lock: `d34b60391a4b7fbafc26507494ad32177bf5676166691155302f95cfeb2dcac6`.
- Startup helper: `00e2bd9c556b9a622ec6a16ccf48f2901521f36e13e5ec2b9985cbce324bfe17`.

The workflow checks out the exact commit into `source`, never current main. The separate
workflow-input checkout is pinned to the triggering push SHA. The original Dockerfile,
release recipe, frozen root lock, manifests, source and compilation are not edited.
`recipe.sh verify` runs the original offline validator and source preflight. One direct
buildx build adds OCI revision/source labels because the original recipe supplies no labels;
BuildKit parallelism is capped at two, original Turbo compilation concurrency remains one.
The original recipe's frozen registry install and network-denied compilation are retained.
Only registry/package acquisition and GitHub checkout/artifact transfer need hosted network.

## Trigger and preview suppression

Only a first branch-creation push to `ops/startup-release-20261008-fetch-fix` in the intended repository
can run. No dispatch, PR trigger, repeat push, rerun or deployment hook is supplied. The job
checks `run_attempt == 1` and `event.created == true`. This deliberately fails closed if
publication occurs in more than one push: do not silently loosen its one-shot gate.
All three input-branch Vercel configs set `git.deploymentEnabled: false` globally for this
branch's tree only. Main's Vercel files are untouched. No old release/preview workflow exists
in the orphan input tree. GitHub artifacts are retained for three days; no registry push.

## What actual image verification means

After the one build, the workflow checks linux/amd64 image config, startup-only entrypoint,
production environment key allowlist and exact OCI source label. It never records a complete
container environment or its values. Docker runs use `--network none`, a read-only filesystem,
UID/GID 1001, no capabilities and no new privileges. The app entrypoint is overridden with
Node, and the verifier is supplied as `node -e` code. The only data mount is the read-only
full-source hash manifest. No application config, provider or server is imported/executed.

The verifier independently checks root ownership/nonwritability, helper/native bytes and
versions, actual installed release acceptance (not cache evidence), preserved compiled
backend/framework/all eight module roots and migration archives. It parses real compiled JS
with the locked installed TypeScript 5.9.3 parser and resolves every literal import/require
without executing application modules; resolved targets and hashes are evidence. Computed
imports, external service functionality, DB startup and deploy readiness are NOT certified.
The original source snapshot excludes generated outputs, dependencies, environment files and
other exclusions in `audit-dependencies.cjs`; it is not a claim to hash every Git blob.
The baked builder snapshot is checked against full-main hashes and critical-root coverage;
it is distinct from the full repository snapshot because Docker COPY and `.dockerignore`
select the original backend build context. No fabricated acceptance or import output exists.

A second isolated Node-only read streams the exact helper bytes to `cmp` against the immutable
source. The artifact is `image.tar.gz` (docker image save + gzip), `image-inspect.json` (sanitized
image config), `image-verification.json`, full source manifest, logs and `SHA256SUMS`.

## Resource budget and review boundary

Use GitHub-hosted Ubuntu 24.04 linux/amd64, one job, 60-minute ceiling. Budget roughly
20–45 minutes for a cold dependency install/build/export; this is an estimate, not a measured
run. Failure of acquisition, source parity, import resolution or a native pin is a hard stop,
not permission to change the recipe or install dependencies locally. No package installation,
Docker build/run, hosted execution or remote publication is part of local authoring.
Pinned checkout/setup-buildx/upload-artifact action commits are embedded in the workflow;
review their upstream provenance before publication. The prior security scanner exception
remains open; this artifact-only build does not claim that scanner is green or production is
unpaused. Parent approval is still required before commit/push and any later deploy.

## Gitlink checkout repair and offline review boundary

The previous published input branch and failed run remain immutable. This is a new,
separately reviewed branch; it does not authorize publication or another hosted build.
Source checkout adds non-cone sparse patterns `/*` and
`!/.claude/worktrees/interesting-jepsen` only. The excluded index entry is mode 160000,
not an application blob; all 3890 source blobs must remain identical. Do not append a
slash to the exclusion: actual Git 2.43 testing showed that leaves the gitlink selected.
No submodule URL is fabricated and neither `.gitmodules` nor main is edited.

IMPORTANT: actual Git 2.43 local tests reproduced the fatal auth-cleanup error even
when that gitlink is correctly skip-worktree and absent on disk. Therefore this sparse
change is a PROPOSED repair, not a green verified checkout fix. Publication is blocked
until the literal checkout cleanup commands pass with the runner's Git version (2.55.0)
or another independently reviewed workflow-only remedy. Local tests and source hashes
are recorded in `review35` outside this six-file input tree. Do not bypass the failure,
turn on persisted credentials, loosen the trigger, or claim this review is build acceptance.

Source fetch uses only transient GitHub read-only authentication, no persistent credentials or submodule initialization. App source/tree are unchanged.
