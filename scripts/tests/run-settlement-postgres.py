#!/usr/bin/env python3
"""Offline, bounded PostgreSQL acceptance for the actual settlement migration/store/engine.

Usage: python3 scripts/tests/run-settlement-postgres.py [--output-dir DIRECTORY]
Uses existing, digest-pinned images only. No pull/install/app entrypoint, production mounts,
provider calls, host ports or external networking. Own fixtures only are created/removed.
Exit 0 = complete expected suite and verified cleanup; 1 = failed acceptance/evidence;
2 = unavailable resource/dependency, startup failure, interruption or cleanup failure.
SIGINT/SIGTERM/timeouts clean up; SIGKILL/host failure cannot be trapped by any launcher.
Canonical logs append (preserving failed attempts); per-run JSON plus latest JSON bind source.
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import uuid

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "packages/modules/b2c-core/src"
HELPER = REPO / "scripts/tests/helpers/settlement-postgres.cjs"
DEFAULT_OUTPUT = Path("/home/hermes/audits/hobbysalon-commerce-fixes-20261002")
BACKEND = "hobbysalon-backend:audit-a899865"
BACKEND_ID = "sha256:7cb352c5130e6661e8ad470535845a1fa593b6d56619632343046d4d033464e1"
POSTGRES = "postgres:16-alpine"
POSTGRES_ID = "sha256:97ff59a4e30e08d1c11bdcd9455e7832368c0572b576c9092cde2df4ae5552a3"
MIB = 1024 * 1024
LABEL = "local.audit.settlement.owner"
EXPECTED = [
    "migration_up_fresh", "migration_down", "migration_reapply",
    *["immutable_" + field for field in ("operation_id", "order_id", "scope_id", "fingerprint", "plan", "created_at")],
    "delete_forbidden", "initial_phase_and_receipt_guard", "phase_graph_all_positive_leg_pairs",
    "zero_legs_follow_only_legal_skips", "plan_identity_and_phase_constraints",
    "autocommit_started_visible_before_each_effect", "competing_same_scope_never_double_effect",
    "equal_amount_independent_operations_after_completed", "different_scopes_progress_concurrently",
    "crash_refund_new_connection_no_retry", "crash_reverse_new_connection_no_retry",
    "completed_replay_new_pool_no_replan_or_effect", "customer_completed_resumes_reversal_only",
    "saved_reversal_receipt_recovers_crashed_started", "first_write_permission_failure_no_effect",
    "started_checkpoint_failure_no_effect", "unique_unfinished_scope_and_duplicate_operation",
    "store_transition_compare_and_swap_and_scope_bound", "real_knex_transaction_rejected",
]


class Blocked(RuntimeError):
    pass


def require(condition, message):
    # Deliberately not Python assert: validation stays enabled under python -O.
    if not condition:
        raise RuntimeError(message)


def timestamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def resources():
    mem = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
    return {"memory_available_bytes": int(mem["MemAvailable"].split()[0]) * 1024,
            "disk_available_bytes": shutil.disk_usage(REPO).free,
            "swap_free_bytes": int(mem["SwapFree"].split()[0]) * 1024}


def source_hashes():
    files = [SOURCE / "utils/refund-settlement.ts", SOURCE / "utils/refund-settlement-store.ts",
             SOURCE / "modules/split-order-payment/migrations/Migration20261002152627.ts", HELPER, Path(__file__).resolve()]
    return {str(file.relative_to(REPO)): hashlib.sha256(file.read_bytes()).hexdigest() for file in files}


def tagged(stdout, tag):
    return [json.loads(line[len(tag) + 1:]) for line in stdout.splitlines() if line.startswith(tag + " ")]


def validate_evidence(stdout, returncode, before):
    runtime = tagged(stdout, "RUNTIME_METADATA")
    summaries = tagged(stdout, "SETTLEMENT_RESULT")
    results = tagged(stdout, "TEST_RESULT")
    require(returncode == 0, f"Node acceptance exited {returncode}")
    require(len(runtime) == 1 and len(summaries) == 1, "missing or duplicated final/runtime receipt")
    summary = summaries[0]
    require([result.get("name") for result in results] == EXPECTED, "missing, reordered or unexpected test identities")
    require(all(result.get("status") == "passed" for result in results), "failed or skipped acceptance cases")
    require(summary.get("results") == results, "summary does not match individual results")
    require(summary.get("expected") == len(EXPECTED) == summary.get("passed"), "reduced suite or incorrect count")
    require(summary.get("failed") == 0 and summary.get("skipped") == 0, "nonzero failure/skip count")
    require(runtime[0].get("expected_tests") == len(EXPECTED), "runtime test inventory mismatch")
    candidate = {str(Path(name).relative_to("packages/modules/b2c-core/src")): digest for name, digest in before.items() if name.startswith("packages/modules/b2c-core/src/")}
    require(runtime[0].get("source_hashes") == candidate, "runtime source was not the preflight candidate")
    migrations = tagged(stdout, "MIGRATION_SQL")
    require([item.get("direction") for item in migrations] == ["up", "down", "up"], "migration cycle not fully executed")
    require([len(item.get("queries", [])) for item in migrations] == [4, 2, 4], "incomplete actual migration SQL")
    crashes = tagged(stdout, "CRASH_OBSERVED")
    require(len(crashes) == 3 and all(c.get("signal") == "SIGKILL" and c.get("code") is None for c in crashes), "missing real process-death evidence")
    require(not tagged(stdout, "FATAL_ERROR") and not tagged(stdout, "CLEANUP_ERROR"), "helper fatal/cleanup error")
    return runtime[0], summary


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / "settlement-postgres.lock").open("a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("BLOCKED: another settlement fixture runner owns this output directory", file=sys.stderr)
        return 2
    run_id = uuid.uuid4().hex
    log_path = output / "settlement-postgres.log"
    latest_path = output / "settlement-postgres.json"
    receipt_path = output / f"settlement-postgres.{run_id}.json"
    meta = {"run_id": run_id, "started_at": timestamp(), "status": "running", "exit_code": None,
            "repository": str(REPO), "log": str(log_path), "receipt": str(receipt_path),
            "expected_tests": EXPECTED, "minimal_checks": [], "results": [],
            "counts": {"passed": 0, "failed": 0, "skipped": 0}, "containers": {}, "cleanup": []}
    owned = []
    log = log_path.open("a", buffering=1)
    def record(event, value):
        line = json.dumps({"time": timestamp(), "run_id": run_id, "event": event, "value": value})
        log.write(line + "\n")
        print(line, flush=True)
    def persist():
        text = json.dumps(meta, indent=2) + "\n"
        receipt_path.write_text(text)
        temporary = output / f".settlement-postgres.{run_id}.tmp"
        temporary.write_text(text)
        os.replace(temporary, latest_path)
    def command(args, timeout=30, check=True, quiet=False):
        if not quiet:
            record("command", args)
        try:
            done = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        except subprocess.TimeoutExpired as error:
            partial = error.stdout or b""
            if isinstance(partial, bytes):
                partial = partial.decode(errors="replace")
            if partial:
                log.write(partial + "\n")
            raise Blocked(f"command timed out after {timeout}s: {args[:3]}") from error
        if done.stdout and not quiet:
            log.write(done.stdout + ("" if done.stdout.endswith("\n") else "\n"))
            print(done.stdout, end="" if done.stdout.endswith("\n") else "\n", flush=True)
        if check and done.returncode:
            raise Blocked(f"command failed ({done.returncode}): {args[:3]} {done.stdout[-1000:]}")
        return done
    def inspect(name):
        done = command(["docker", "container", "inspect", name], check=False, quiet=True)
        if done.returncode:
            if "No such" in done.stdout:
                return None
            raise Blocked(f"cannot inspect owned fixture {name}: {done.stdout[-300:]}")
        return json.loads(done.stdout)[0]
    def create(kind, args, image, tail):
        name = f"settlement-{kind}-{run_id[:12]}"
        owned.append(name)  # before create, so interrupted CLI still has a known cleanup target
        done = command(["docker", "create", "--name", name, "--label", f"{LABEL}={run_id}", "--pull=never", *args, image, *tail])
        meta["containers"][kind] = {"name": name, "id": done.stdout.strip()}
        return name
    def verify_container(name, network, memory, allowed_binds):
        data = inspect(name)
        if data is None:
            raise RuntimeError("fixture vanished before isolation verification")
        host = data["HostConfig"]
        require(host["NetworkMode"] in network, "unexpected fixture network")
        require(not host.get("PortBindings") and not host["Privileged"], "fixture exposes host networking/privilege")
        require(host["Memory"] == memory * MIB and host["MemorySwap"] == memory * MIB, "memory/swap cap mismatch")
        require(host["ReadonlyRootfs"], "writable image root")
        require(data["Config"].get("Labels", {}).get(LABEL) == run_id, "fixture ownership mismatch")
        actual = []
        for mount in data["Mounts"]:
            require(mount["Type"] in ("bind", "tmpfs"), "unexpected volume mount")
            if mount["Type"] == "bind":
                require(not mount["RW"], "writable source mount")
                actual.append((mount["Source"], mount["Destination"]))
        require(sorted(actual) == sorted(allowed_binds), "unexpected source/production mount")
        record("isolation_verified", {"name": name, "network": host["NetworkMode"], "memory": host["Memory"], "binds": actual})
    def interrupted(signum, _frame):
        raise Blocked(f"interrupted by signal {signum}")
    previous_signals = {s: signal.signal(s, interrupted) for s in (signal.SIGINT, signal.SIGTERM)}
    exit_code = 2
    persist()
    try:
        record("start", {"repository": str(REPO), "expected_count": len(EXPECTED)})
        ast.parse(Path(__file__).read_text())
        require(len(EXPECTED) == 28 and len(set(EXPECTED)) == 28, "launcher inventory mismatch")
        meta["minimal_checks"].append({"name": "python_syntax_and_inventory", "status": "passed"})
        before = source_hashes()
        meta["source_hashes_before"] = before
        meta["minimal_checks"].append({"name": "candidate_files_present_and_hashed", "status": "passed"})
        meta["resources_before"] = resources()
        record("resources", meta["resources_before"])
        require(shutil.which("docker") is not None, "Docker CLI unavailable")
        for label, image, expected_id in [("backend", BACKEND, BACKEND_ID), ("postgres", POSTGRES, POSTGRES_ID)]:
            done = command(["docker", "image", "inspect", image, "--format", "{{json .Id}} {{json .RepoDigests}}"], check=False)
            if done.returncode:
                raise Blocked(f"required offline image unavailable: {image}; no pull attempted")
            identity, digests = done.stdout.strip().split(" ", 1)
            image_id = json.loads(identity)
            if image_id != expected_id:
                raise Blocked(f"offline image digest changed: {image}; review pin before rerun")
            meta.setdefault("images", {})[label] = {"tag": image, "id": image_id, "repo_digests": json.loads(digests)}
        meta["minimal_checks"].append({"name": "offline_image_pins", "status": "passed"})
        resource = resources()
        if resource["memory_available_bytes"] < 256 * MIB or resource["disk_available_bytes"] < 192 * MIB:
            raise Blocked("insufficient capacity even for bounded Node syntax check; static checks completed")
        helper_target = "/app/apps/backend/settlement-postgres.cjs"
        source_target = "/app/apps/backend/audit-src"
        common = ["--read-only", "--ulimit", "core=0:0", "--pids-limit", "64", "--security-opt", "no-new-privileges"]
        node_args = [*common, "--user", f"{os.getuid()}:{os.getgid()}", "--memory", "192m", "--memory-swap", "192m", "--cap-drop", "ALL", "--entrypoint", "node",
                     "--mount", f"type=bind,source={HELPER},target={helper_target},readonly"]
        syntax = create("syntax", [*node_args, "--network", "none"], BACKEND_ID, ["--check", helper_target])
        verify_container(syntax, ["none"], 192, [(str(HELPER), helper_target)])
        command(["docker", "start", "--attach", syntax], timeout=30)
        meta["minimal_checks"].append({"name": "node_syntax", "status": "passed"})
        resource = resources()
        meta["resources_before_postgres"] = resource
        if resource["memory_available_bytes"] < 448 * MIB or resource["disk_available_bytes"] < 256 * MIB:
            raise Blocked("heavy PostgreSQL path stopped: need >=448 MiB available RAM and >=256 MiB disk; minimal checks completed")
        postgres = create("pg", [*common, "--network", "none", "--memory", "128m", "--memory-swap", "128m",
            "--shm-size", "8m", "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=128m",
            "--tmpfs", "/var/run/postgresql:rw,noexec,nosuid,size=4m", "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m",
            "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_USER=postgres", "-e", "POSTGRES_DB=postgres"],
            POSTGRES_ID, ["postgres", "-c", "listen_addresses=127.0.0.1", "-c", "max_connections=12",
                "-c", "shared_buffers=8MB", "-c", "work_mem=512kB", "-c", "maintenance_work_mem=8MB",
                "-c", "wal_buffers=1MB", "-c", "min_wal_size=32MB", "-c", "max_wal_size=32MB",
                "-c", "fsync=on", "-c", "synchronous_commit=on"])
        verify_container(postgres, ["none"], 128, [])
        command(["docker", "start", postgres])
        deadline = time.monotonic() + 45
        while True:
            ready = command(["docker", "exec", postgres, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres"], timeout=5, check=False, quiet=True)
            if ready.returncode == 0:
                break
            state = inspect(postgres)
            if state is None or not state["State"]["Running"]:
                raise Blocked("PostgreSQL fixture exited before TCP readiness")
            if time.monotonic() >= deadline:
                raise Blocked("PostgreSQL final TCP server not ready within 45 seconds")
            time.sleep(0.4)
        record("postgres_tcp_ready", {"host": "127.0.0.1", "port": 5432})
        command(["docker", "exec", postgres, "createdb", "-h", "127.0.0.1", "-U", "postgres", "settlement_acceptance"])
        node = create("node", [*node_args, "--network", f"container:{postgres}",
            "--mount", f"type=bind,source={SOURCE},target={source_target},readonly", "-e", "SETTLEMENT_ISOLATED_FIXTURE=1", "-e", "NODE_OPTIONS="],
            BACKEND_ID, ["--max-old-space-size=64", helper_target])
        verify_container(node, [f"container:{postgres}", f"container:{meta['containers']['pg']['id']}"], 192,
                         [(str(HELPER), helper_target), (str(SOURCE), source_target)])
        done = command(["docker", "start", "--attach", node], timeout=180, check=False)
        meta["node_exit_code"] = done.returncode
        meta["results"] = tagged(done.stdout, "TEST_RESULT")
        meta["counts"] = {status: sum(r.get("status") == status for r in meta["results"]) for status in ("passed", "failed", "skipped")}
        meta["runtime_receipts"] = tagged(done.stdout, "RUNTIME_METADATA")
        meta["summary_receipts"] = tagged(done.stdout, "SETTLEMENT_RESULT")
        runtime, summary = validate_evidence(done.stdout, done.returncode, before)
        meta["runtime"] = runtime
        meta["summary"] = summary
        meta["source_hashes_after"] = source_hashes()
        require(meta["source_hashes_after"] == before, "candidate changed during execution: acceptance is stale")
        # Exercise the actual receipt consumer against reduced evidence. Reject omission, false
        # counts and an empty green wrapper; never quietly accept only the cases that happened to run.
        variants = ["", "\n".join(line for line in done.stdout.splitlines() if not line.startswith('TEST_RESULT ')),
                    done.stdout.replace('"passed":28', '"passed":0')]
        for variant in variants:
            try:
                validate_evidence(variant, 0, before)
            except (RuntimeError, ValueError, KeyError, TypeError):
                pass
            else:
                raise RuntimeError("receipt consumer accepted deliberately reduced/altered evidence")
        meta["minimal_checks"].append({"name": "receipt_consumer_negative_controls", "status": "passed"})
        meta["status"] = "passed"
        exit_code = 0
    except Blocked as error:
        meta["status"] = "blocked"
        meta["error"] = str(error)
        record("blocked", str(error))
        exit_code = 2
    except Exception as error:
        meta["status"] = "failed"
        meta["error"] = f"{type(error).__name__}: {error}"
        record("failed", meta["error"])
        exit_code = 1
    finally:
        # Do not let a repeated Ctrl-C interrupt removal of our fixtures.
        for signum in previous_signals:
            signal.signal(signum, signal.SIG_IGN)
        for name in reversed(owned):
            try:
                data = inspect(name)
                if data is None:
                    meta["cleanup"].append({"name": name, "absent": True})
                    continue
                require(data["Config"].get("Labels", {}).get(LABEL) == run_id, "refusing to remove non-owned container")
                state = data["State"]
                meta["cleanup"].append({"name": name, "state_before_removal": {key: state.get(key) for key in ("Status", "ExitCode", "OOMKilled", "Error")}})
                if state.get("OOMKilled"):
                    meta["status"] = "blocked"
                    meta["error"] = "fixture OOM killed; partial results are not acceptance"
                    exit_code = 2
                if name.startswith("settlement-pg-"):
                    command(["docker", "logs", name], check=False)
                command(["docker", "rm", "--force", name])
                require(inspect(name) is None, "fixture still exists after removal")
                meta["cleanup"][-1]["removed_and_verified"] = True
            except Exception as error:
                meta["cleanup"].append({"name": name, "error": str(error)})
                meta["status"] = "cleanup_failed"
                exit_code = 2
                record("cleanup_failed", str(error))
        try:
            meta["source_hashes_after"] = source_hashes()
            meta["resources_after"] = resources()
            if meta.get("source_hashes_before") != meta["source_hashes_after"] and exit_code == 0:
                meta["status"] = "failed"
                meta["error"] = "source changed by end of run"
                exit_code = 1
        except Exception as error:
            meta["final_check_error"] = str(error)
            exit_code = 2
        meta["finished_at"] = timestamp()
        meta["exit_code"] = exit_code
        record("finished", {"status": meta["status"], "exit_code": exit_code, "counts": meta["counts"], "metadata": str(latest_path)})
        persist()
        log.close()
        for signum, handler in previous_signals.items():
            signal.signal(signum, handler)
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()
    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    sys.exit(run(args.output_dir.resolve()))
