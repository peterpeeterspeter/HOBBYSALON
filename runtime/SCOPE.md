# One exact-image synthetic runtime attempt

This branch contains only an isolated GitHub-hosted verification harness. It is not an application source release or deployment branch.

- Reuse the immutable previously built artifact; no rebuild or image publication.
- One branch-creation push, first run attempt only; no automatic or manual retries.
- Read-only repository/artifact permissions; acquisition token confined to its own step.
- Dedicated Docker and containerd processes, private sockets and a new hard six-GiB filesystem.
- Fresh synthetic PostgreSQL and Redis only, loopback-only shared network namespace, no host/provider sockets or external container routes.
- Ephemeral dummy configuration, read-only image root, dropped capabilities and bounded memory/time.
- Native migration, compiled boot, HTTP health, graceful restart and catalog-subset preservation checks.
- Preserve bounded synthetic logs and database snapshots before ownership-checked cleanup; retain evidence seven days.
- Runtime PASS requires independent final receipt and cleanup checks plus successful evidence upload.

An isolated runtime PASS is not provider verification, financial recovery, business-consumer acknowledgement, rollback acceptance, or global production GO. No main merge, PR, deployment, production database or provider modification is authorized by this harness.
