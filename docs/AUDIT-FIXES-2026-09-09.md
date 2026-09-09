# HOBBYSALON audit remediation — 2026-09-09

Base: `ee025a2eead18cda86623bc1bd8f83a06d2a8600`. Fix branch: `fix/audit-security-reliability`.

## Implemented

1. Project mutations require ownership of the project by the authenticated creator. Caller-created creator/project links no longer confer editing rights; association creation is also ownership-checked. Missing/non-owned projects fail closed.
2. Article ownership is verified before writing, and an update must return a matched row before recommendation links are changed.
3. Inventory, validation, transport, and ambiguous cart errors preserve the active cart. Replacement requires independently verified missing/completed cart state; its cookie is committed only after successful progress. Partial bundle progress is not discarded or blindly replayed.
4. Auth session and post-auth targets share a same-origin redirect sanitizer, including backslash/control/encoded/dot-segment bypass checks.
5. Payment grants and success markers are now one PostgreSQL transaction. Credit ledger/wallet changes, plan expiration/replacement, and workshop activation roll back together. RPC execution is restricted; the route does not delete markers after ambiguous network failures. Historical evidence and pre-cutover workshop sessions require reconciliation instead of automatic regranting.
6. Merchant retry repairs missing owner/onboarding records before shipping setup. Persisted seller identity is authoritative; unrelated memberships are not elevated. Registration/repair is serialized by a normalized-email PostgreSQL transaction advisory lock.
7. CI now runs the security/provisioning Vitest suite and the disposable PostgreSQL payment test, including independent concurrent connections.
8. Next.js and eslint-config-next are 16.3.4. Targeted dependency overrides/resolutions patch handlebars, protobufjs, and both relevant fast-xml-parser major lines. Yarn and npm locks were regenerated.

## Verification actually run

- 190 Node unit tests passed.
- 163 Vitest security/provisioning tests passed (including the previous 18 security tests).
- Storefront TypeScript `--noEmit --incremental false`: passed.
- Storefront ESLint: passed.
- Next.js 16.3.4 production build: passed with placeholder Supabase/Medusa configuration, not production credentials.
- `bash scripts/test-payment-atomicity.sh`: passed on isolated PostgreSQL 16, with rollback fault injection, permissions, legacy/orphan handling, owner checks, duplicate delivery, four concurrent deliveries of one credit purchase, and concurrent competing plan purchases.
- New merchant concurrent creation/repair tests were observed failing before the mutex and passing after it. Historical workshop replay SQL regression likewise failed before the cutoff guard and passed after it.
- Final independent review found no new blockers in the corrected application paths. Earlier review findings were addressed.
- Yarn frozen **resolution** validation passed for 2472 selectors without network/fetch/link/build. This is not a full monorepo installation.

## Remaining dependency risk — not fully remediated

The root npm lock audit moved from **5 critical / 44 high** entries to **1 critical / 43 high** (98 moderate, 3 low remain). Counts are dependency audit entries, not distinct exploitable application bugs.

The remaining critical package is `@mikro-orm/core` 6.4.16 (GHSA-gwhv-j974-6fxm; patched in 6.6.10). Medusa's dependency family pins the older ORM. A coordinated supported Medusa/MikroORM upgrade and full backend integration testing remain necessary; this patch intentionally does not force a lone ORM replacement or claim a clean dependency audit. Other high/moderate/low advisories also remain.

The lock refresh has broader transitive movement. Full frozen Yarn installation and the complete monorepo build/backend integration suite must pass in adequately provisioned CI before merging. Local verification covered storefront installation/build, mocked backend registration behavior, and real payment SQL—not every backend service.

## Deployment gate — migration has NOT been applied to production

Do not deploy only the new webhook route: it depends on `supabase/migrations/20260909120000_atomic_listing_checkout.sql`.

1. Verify existing listing-credit, commercial-plan and workshop-fee schema prerequisites.
2. Pause Stripe listing-webhook delivery and drain old workers/in-flight requests. Old handlers must not overlap the new handler because the old error path can delete a committed marker.
3. Apply the migration, then deploy the new route, then resume/retry deliveries. Do not roll back to the old handler.
4. A legacy marker with NULL `fulfilled_at` is ambiguous, not evidence of failure. Follow the migration's audited reconciliation procedure. Never bulk-delete markers, infer non-delivery from current balances, or move the global migration boundary.
5. Historical workshop sessions, including checkouts opened before cutover but paid later, are deliberately held for reconciliation; the old flow had no reliable per-session workshop ledger. Escalate `legacy_blocked` / HTTP 503 rather than regrant blindly.
6. If an earlier four-argument draft RPC was ever installed separately, explicitly remove that overload before enabling the five-argument route. No draft was applied to production during this work.
7. Validate backend connection-pool headroom under concurrent merchant provisioning: the advisory-lock transaction holds a connection while service work uses other connections. The unit concurrency tests mock the lock, not a full Medusa deployment.

No production database data was accessed or changed. No production deployment was performed.
