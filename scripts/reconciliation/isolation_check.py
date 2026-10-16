#!/usr/bin/env python3
"""Bounded READ ONLY observation. Never a fence, receipt, launch gate or repair.

Fixed old identities only; shared PostgreSQL is preserved, never stopped. The
candidate discovery constant is intentionally unset: no guessed future runtime.
CLI constructs the real reader; only pure evaluate accepts test-only projections.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import re
import selectors
import stat
import subprocess
import sys
import time
from types import MappingProxyType

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from scripts.reconciliation import db_readonly as db
    from scripts.reconciliation.exact_json import encode_json, decode_json
else:
    from . import db_readonly as db
    from .exact_json import encode_json, decode_json

OLD_NAMES = {"app": "hs-gate-app-53332bce", "redis": "hs-gate-redis-53332bce",
             "postgres": "hs-gate-pg-53332bce"}
OLD_IDENTITIES = {
    "app": "f57e92e1603fca231c32606de077ea13b4bf8cd1c7a2f444f24b9df3d775fe1d",
    "redis": "53748887f3379979a1000801c99eb2bcea2337f9c472035902e7b6439d3e002a",
    "postgres": "a35833bdfa1cbb9cc923abae458d8d362f57188225a4c4ecc7d85e3c17d0eaab",
}
OLD_DATABASE = "hobbysalon_e2e_gate_53332bce"
OLD_RUNTIME = Path("/home/hermes/.config/hobbysalon-refund-gate-runtime/state.json")
BASELINE = Path("/home/hermes/audits/hobbysalon-reconciliation-20261005/provider-user-confirmed/LEDGER-old.json")
HISTORY_REPORT = "/home/hermes/audits/hobbysalon-reconciliation-20261005/toward-go/HISTORICAL-NO-EFFECT-SEARCH.nl.md"
# Must be independently configured/reviewed in source before a future discovery.
# No caller-supplied Docker names, guessed prefix, booleans or JSON attestations.
CANDIDATE_DISCOVERY = None
HEX = re.compile(r"[0-9a-f]{64}\Z")
MAX_JSON = 20_000_000


class IsolationBlocked(ValueError):
    pass


def bounded_run(command, *, input=None, text=True, capture_output=True,
                timeout=45, check=False, limit=MAX_JSON):
    """Drain both pipes with an aggregate byte cap and a wall-clock deadline.

    subprocess output/error text never escapes this boundary on failure.
    """
    if input is not None and len(input.encode()) > 100_000:
        raise IsolationBlocked("input_bound")
    with subprocess.Popen(command, stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE) as proc:
        try:
            assert proc.stdout is not None and proc.stderr is not None
            chunks = {proc.stdout.fileno(): bytearray(), proc.stderr.fileno(): bytearray()}
            total = 0; deadline = time.monotonic() + timeout
            pending = memoryview(input.encode()) if input is not None else memoryview(b"")
            with selectors.DefaultSelector() as selector:
                selector.register(proc.stdout, selectors.EVENT_READ)
                selector.register(proc.stderr, selectors.EVENT_READ)
                if proc.stdin is not None:
                    os.set_blocking(proc.stdin.fileno(), False)
                    selector.register(proc.stdin, selectors.EVENT_WRITE)
                while selector.get_map():
                    remaining = deadline - time.monotonic()
                    if remaining <= 0: raise IsolationBlocked("read_timeout")
                    for key, _ in selector.select(min(remaining, .2)):
                        if key.events == selectors.EVENT_WRITE:
                            if pending:
                                pending = pending[os.write(key.fd, pending[:4096]):]
                            if not pending:
                                selector.unregister(key.fileobj)
                                assert proc.stdin is not None
                                proc.stdin.close()
                            continue
                        data = os.read(key.fd, 65536)
                        if not data: selector.unregister(key.fileobj); continue
                        total += len(data)
                        if total > limit: raise IsolationBlocked("output_bound")
                        chunks[key.fd].extend(data)
            proc.wait(timeout=max(.01, deadline - time.monotonic()))
            return subprocess.CompletedProcess(command, proc.returncode,
                     bytes(chunks[proc.stdout.fileno()]).decode("utf-8"),
                     bytes(chunks[proc.stderr.fileno()]).decode("utf-8"))
        except Exception:
            proc.kill(); proc.wait()
            raise IsolationBlocked("bounded_read_failed") from None


def project_container(raw, role):
    """Only fixed identity, running/restart, non-loopback ports and network IDs.

    No Env, labels, mounts, image configuration, addresses or private payloads.
    """
    try:
        name = OLD_NAMES[role]
        if raw["Name"] != "/" + name or raw["Id"] != OLD_IDENTITIES[role]: raise ValueError
        running = raw["State"]["Running"]
        restart = raw["HostConfig"]["RestartPolicy"]["Name"]
        if type(running) is not bool or restart not in ("no", "always", "unless-stopped", "on-failure"): raise ValueError
        mode = raw["HostConfig"]["NetworkMode"]
        unsafe_mode = mode == "host" or mode.startswith("container:")
        networks = raw["NetworkSettings"]["Networks"]
        ids = sorted({v["NetworkID"] for v in networks.values()})
        namespace_id = mode.split(":", 1)[1] if mode.startswith("container:") else None
        if namespace_id is not None and not HEX.fullmatch(namespace_id): raise ValueError
        if (not ids and not unsafe_mode) or any(not HEX.fullmatch(x) for x in ids): raise ValueError
        ports = []
        for bindings in (raw["NetworkSettings"]["Ports"] or {}).values():
            for binding in bindings or []:
                host = binding["HostIp"]; port = int(binding["HostPort"])
                if not isinstance(host, str) or not 1 <= port <= 65535: raise ValueError
                if host not in ("127.0.0.1", "::1"):
                    ports.append({"port": port, "wildcard": host in ("", "0.0.0.0", "::")})
        return {"name": name, "identity": raw["Id"], "running": running, "restart": restart,
                "external_ports": sorted(ports, key=lambda p: (p["port"], p["wildcard"])),
                "network_ids": ids, "unsafe_network_mode": unsafe_mode,
                "network_namespace_identity": namespace_id,
                "ports_complete": not unsafe_mode}
    except Exception:
        raise IsolationBlocked("container_identity_or_shape_unknown") from None


def ordered(value, key=""):
    """Known rowsets are multisets; unknown/nested JSON arrays retain exact order."""
    if isinstance(value, dict): return {k: ordered(v, k) for k, v in value.items()}
    if isinstance(value, list):
        rows = [ordered(v) for v in value]
        return sorted(rows, key=encode_json) if key in {*db.FIELDS, "rows", "payments", "captures", "refunds", "transactions", "quarantine", "issues"} else rows
    return value


def fingerprint(value):
    return hashlib.sha256(encode_json(ordered(value)).encode()).hexdigest()


def _private_bytes(path, cap):
    """Bind bounded bytes to stable descriptor metadata, not a historical seal.

    Does not claim immunity against privileged content/metadata restoration.
    O_NONBLOCK also prevents a substituted FIFO from hanging before fstat.
    """
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as stream:
        before = os.fstat(stream.fileno())
        if (not stat.S_ISREG(before.st_mode) or before.st_uid != os.getuid()
                or stat.S_IMODE(before.st_mode) != 0o600 or not 0 <= before.st_size <= cap):
            raise IsolationBlocked("private_file_required")
        raw = stream.read(before.st_size + 1)
        after = os.fstat(stream.fileno())
        fields = ("st_dev", "st_ino", "st_mode", "st_uid", "st_size", "st_mtime_ns", "st_ctime_ns")
        if (len(raw) != before.st_size or len(raw) > cap
                or any(getattr(before, f) != getattr(after, f) for f in fields)):
            raise IsolationBlocked("private_read_changed")
    return raw


def _runtime_snapshot():
    """Validate privately acquired bytes; return no credential-bearing values."""
    try:
        raw = _private_bytes(OLD_RUNTIME, 65536)
        state = decode_json(raw.decode("utf-8"))
        expected = {"db": OLD_DATABASE, "pg": OLD_NAMES["postgres"], "app": OLD_NAMES["app"]}
        if (not isinstance(state, dict) or state.get("production_release") is True
                or {k: state.get(k) for k in expected} != expected
                or db.SANDBOXES.get(OLD_DATABASE) != (expected["pg"], expected["app"])):
            raise ValueError
        return MappingProxyType(expected), hashlib.sha256(raw).digest()
    except Exception:
        raise IsolationBlocked("runtime_unavailable") from None


def read_runtime():
    return _runtime_snapshot()[0]


def read_baseline():
    try:
        raw = _private_bytes(BASELINE, MAX_JSON)
        value = decode_json(raw.decode("utf-8"))
        if not isinstance(value, dict) or set(value) != {"completion_semantics", "counts", "issues", "payments", "scope", "status"}: raise ValueError
        return value, hashlib.sha256(raw).hexdigest()
    except Exception:
        raise IsolationBlocked("baseline_unavailable") from None


def _data_sql(columns):
    return "SELECT jsonb_build_object('schema',(" + db._schema_sql() + "),'snapshot',jsonb_build_object(" + ",".join(db._projection_sql(t) for t in db.FIELDS if t in columns) + "))"


def pinned_runner(sql, *, schema=None):
    """Private per-query runner: only the exact generated read is executable.

    The sealed _psql runner hook is scoped; no global library monkeypatch.
    Mutable name is allowed only as the measured command input, never as target.
    """
    approved_sql = db._schema_sql() if schema is None else _data_sql(db._validate_schema(schema))
    if sql != approved_sql:
        raise IsolationBlocked("only_generated_read_sql")
    expected = ["docker", "exec", "-i", OLD_NAMES["postgres"], "psql", "-X", "-qAt", "-h", "/var/run/postgresql", "-p", "5432", "-U", "gate", "-d", OLD_DATABASE, "-v", "ON_ERROR_STOP=1"]
    script = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='3s';\n" + sql + ";\nROLLBACK;\n"
    expected_kwargs = dict(input=script, text=True, capture_output=True, timeout=45, check=False)
    def run(command, **kwargs):
        if command != expected or kwargs != expected_kwargs or not HEX.fullmatch(OLD_IDENTITIES["postgres"]):
            raise IsolationBlocked("old_binding_or_read_shape_mismatch")
        pinned = list(command)
        pinned[3] = OLD_IDENTITIES["postgres"]
        return bounded_run(pinned, **kwargs)
    return run


def scan_old_runtime(runtime):
    """Local acquisition using sealed typed projections/schema/normalization.

    scan_runtime's runner is supported but its config reread is unsafe here.
    Preserve its schema discovery, same-RRRO schema recheck and overflow guards.
    """
    if dict(runtime) != {"db": OLD_DATABASE, "pg": OLD_NAMES["postgres"], "app": OLD_NAMES["app"]}:
        raise IsolationBlocked("old_binding_mismatch")
    schema_sql = db._schema_sql()
    schema_output = db._psql(runtime, schema_sql, runner=pinned_runner(schema_sql))
    if len(schema_output) != 1: raise IsolationBlocked("schema_snapshot_required")
    schema = schema_output[0]
    columns = db._validate_schema(schema)
    data_sql = _data_sql(columns)
    result = db._psql(runtime, data_sql, runner=pinned_runner(data_sql, schema=schema))
    if len(result) != 1 or not isinstance(result[0], dict) or result[0].get("schema") != schema:
        raise IsolationBlocked("schema_changed_during_scan")
    snapshot = result[0].get("snapshot")
    if (not isinstance(snapshot, dict) or set(snapshot) != set(db.FIELDS).intersection(columns)
            or any(not isinstance(v, list) or len(v) > 100000 for v in snapshot.values())):
        raise IsolationBlocked("native_full_scan_bound_or_shape")
    rows, issues = db.normalize(snapshot)
    return ({"rows": rows, "counts": {t: len(v) for t, v in snapshot.items()},
             "issues": issues, "complete": True, "database": runtime["db"]}, snapshot, fingerprint(schema))


def inspect_old_containers():
    result = bounded_run(["docker", "inspect", *OLD_NAMES.values()], timeout=15, limit=1_000_000)
    if result.returncode: raise IsolationBlocked("inspect_failed")
    raw = decode_json(result.stdout)
    if not isinstance(raw, list) or len(raw) != len(OLD_NAMES): raise IsolationBlocked("inspect_shape")
    containers = {}
    for role, name in OLD_NAMES.items():
        matches = [r for r in raw if isinstance(r, dict) and r.get("Name") == "/" + name]
        if len(matches) != 1: raise IsolationBlocked("inspect_identity")
        containers[role] = project_container(matches[0], role)
    return containers


def evaluate(observation, *, test_only=False):
    """One pure evaluator; accepts projected observations, never grants authority.

    Even a structurally green synthetic fixture has launch:NO_GO. Claimed fence,
    drain, account-creation, routing and isolated booleans are deliberately ignored.
    """
    blockers = {"unverified_external_fence"}
    errors = bool(observation.get("acquisition_errors"))
    containers = observation.get("containers") or {}
    for role in OLD_NAMES:
        container = containers.get(role)
        if not isinstance(container, dict):
            blockers.add(role + "_missing"); errors = True; continue
        if container.get("name") != OLD_NAMES[role] or container.get("identity") != OLD_IDENTITIES[role]:
            blockers.add(role + "_unknown_identity"); errors = True
        if type(container.get("running")) is not bool or container.get("restart") not in ("no", "always", "unless-stopped", "on-failure"):
            blockers.add(role + "_unknown_state"); errors = True
        ids = container.get("network_ids")
        if not isinstance(ids, list) or (not ids and not container.get("unsafe_network_mode")) or any(not isinstance(x, str) or not HEX.fullmatch(x) for x in ids):
            blockers.add(role + "_unknown_network"); errors = True
        if container.get("unsafe_network_mode"): blockers.add(role + "_shared_network_mode")
        if role in ("app", "redis"):
            if container.get("ports_complete") is False: blockers.add(role + "_namespace_ports_unverified")
            if container.get("running") is not False: blockers.add(role + "_running")
            if container.get("restart") != "no": blockers.add(role + "_auto_restart")
            if not isinstance(container.get("external_ports"), list):
                blockers.add(role + "_unknown_ports"); errors = True
            elif container["external_ports"]: blockers.add(role + "_external_ports")
        elif container.get("running") is not True: blockers.add("preserved_postgres_unavailable")
    if observation.get("old_database") != OLD_DATABASE:
        blockers.add("old_database_mismatch"); errors = True
    if observation.get("scan_complete") is not True:
        blockers.add("old_native_scan_unverified"); errors = True
    baseline = observation.get("baseline_match")
    if baseline is None: blockers.add("baseline_unavailable"); errors = True
    elif baseline is not True: blockers.add("baseline_projection_changed")
    candidate = observation.get("candidate")
    if not isinstance(candidate, dict) or candidate.get("configured") is not True:
        blockers.add("candidate_not_configured")
    else:
        if candidate.get("identity_verified") is not True: blockers.add("candidate_identity_unverified")
        if not candidate.get("database") or candidate.get("database") == OLD_DATABASE or candidate.get("namespace_distinct") is not True:
            blockers.add("shared_database_namespace")
        old_ids = {x for v in containers.values() if isinstance(v, dict) for x in (v.get("network_ids") or []) if isinstance(x, str)}
        new_ids = candidate.get("network_ids") or []
        if not new_ids or any(not isinstance(x, str) or not HEX.fullmatch(x) for x in new_ids) or old_ids.intersection(new_ids):
            blockers.add("shared_network_namespace")
    structural = blockers - {"unverified_external_fence"}
    return {"status": "isolation_not_established", "launch": "NO_GO",
            "exit_code": 3 if errors else 2, "blockers": sorted(blockers),
            "structural_readiness": "blocked" if structural else ("synthetic_readiness_only" if test_only else "observed_prerequisites_only"),
            "observation_non_atomic": True, "external_writer_drain_provider_routing": "unknown",
            "authority": "none", "old_financial_database": "preserve_quarantines_and_obligations",
            "shared_postgres": "namespace_isolation_required_not_resource_stop",
            "historical_no_effect_search": HISTORY_REPORT}


class ReadOnlyAcquisition:
    """Real constructors only. No dependency injection or input attestations in CLI."""
    def acquire(self):
        o = {"containers": {}, "candidate": None, "acquisition_errors": []}
        details: dict = {"candidate_discovery": "not_configured", "schema_native_helper": "local_acquisition_reuses_sealed_schema_and_typed_projections"}
        try:
            o["containers"] = inspect_old_containers()
            details["containers"] = o["containers"]
        except Exception: o["acquisition_errors"].append("fixed_container_inspection_failed")
        try:
            if any(o["containers"].get(role, {}).get("identity") != OLD_IDENTITIES[role] for role in OLD_NAMES):
                raise IsolationBlocked("fixed_identities_required_before_native_read")
            runtime, runtime_digest = _runtime_snapshot()
            o["old_database"] = runtime["db"]
            scan, native, schema_hash = scan_old_runtime(runtime)
            # Reinspect names/full IDs after both reads; exec itself always uses ID.
            # Recheck private bytes without using them to redirect either transaction.
            after = inspect_old_containers()
            details["containers_after_native_read"] = after
            runtime_after, digest_after = _runtime_snapshot()
            if runtime_after != runtime or digest_after != runtime_digest:
                raise IsolationBlocked("runtime_changed_during_native_scan")
            if scan["database"] != OLD_DATABASE or scan["complete"] is not True:
                raise IsolationBlocked("full_projection_required")
            o["scan_complete"] = True
            details["native"] = {"counts": scan["counts"], "normalized_rows": len(scan["rows"]),
                "issue_count": len(scan["issues"]), "quarantined_rows": sum(bool(r["quarantine"]) for r in scan["rows"]),
                "normalized_rows_counts_issues_sha256": fingerprint({k: scan[k] for k in ("rows", "counts", "issues")}),
                "entire_projected_native_graph_sha256": fingerprint(native),
                "schema_sha256": schema_hash, "exec_target_identity": OLD_IDENTITIES["postgres"],
                "schema_rechecked_in_data_rrro": True,
                "scope": "all_rows_in_existing_financial_projection_including_deleted_not_raw_archive"}
            baseline, raw_hash = read_baseline()
            current = db.ledger_report(scan)
            o["baseline_match"] = ordered(baseline) == ordered(current)
            details["saved_ledger_comparison"] = {"matches": o["baseline_match"],
                "baseline_current_bytes_sha256": raw_hash, "baseline_projection_sha256": fingerprint(baseline),
                "current_projection_sha256": fingerprint(current),
                "scope": "saved_LEDGER_schema_only_not_entire_native_or_historical_immutable_archive"}
        except Exception: o["acquisition_errors"].append("old_read_or_baseline_failed")
        report = evaluate(o)
        report["observations"] = details
        report["acquisition_errors"] = o["acquisition_errors"]
        report["observed_at_utc"] = datetime.now(timezone.utc).isoformat()
        report["hash_semantics"] = "current_private_observation_not_historical_seal_or_external_fence"
        return report


def emit(report, output=None):
    encoded = encode_json(report) + "\n"
    if len(encoded.encode()) > 65536: raise IsolationBlocked("report_bound")
    if output:
        fd = os.open(Path(output).expanduser(), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(encoded); stream.flush(); os.fsync(stream.fileno())
    return encoded


class SafeParser(argparse.ArgumentParser):
    def error(self, message): raise IsolationBlocked("invalid_arguments")


def main(argv=None):
    parser = SafeParser(description="READ ONLY vaste oude runtime; geen isolatie-acties, attestatie of GO. Exit 2: NO_GO, 3: onvolledige observatie/uitvoer.")
    parser.add_argument("--output", help="Nieuw rapport, exclusief 0600; bestaande paden geweigerd")
    try:
        args = parser.parse_args(argv)
        report = ReadOnlyAcquisition().acquire()
        encoded = emit(report, args.output)
    except Exception:
        report = evaluate({"acquisition_errors": ["safe_read_or_output_failed"]})
        report["error"] = "safe_read_arguments_or_exclusive_output_failed"
        encoded = emit(report)
    print(encoded, end="")
    return report["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
