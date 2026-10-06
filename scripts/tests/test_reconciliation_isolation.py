"""Offline structural checks never establish operational isolation or authority."""
import copy
from decimal import Decimal
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import io
import os
from types import SimpleNamespace
from unittest.mock import patch

from scripts.reconciliation import isolation_check as c


def fixture():
    containers = {}
    for role, name in c.OLD_NAMES.items():
        containers[role] = {"name": name, "identity": c.OLD_IDENTITIES[role],
                            "running": role == "postgres", "restart": "no",
                            "external_ports": [], "network_ids": ["b" * 64]}
    return {"containers": containers, "old_database": c.OLD_DATABASE,
            "scan_complete": True, "baseline_match": True,
            "candidate": {"configured": True, "identity_verified": True,
                          "database": "explicit_future_namespace", "namespace_distinct": True,
                          "network_ids": ["c" * 64]}, "acquisition_errors": []}


class IsolationTests(unittest.TestCase):
    def test_synthetic_green_is_never_operational_pass(self):
        r = c.evaluate(fixture(), test_only=True)
        self.assertEqual(r["structural_readiness"], "synthetic_readiness_only")
        self.assertEqual(r["status"], "isolation_not_established")
        self.assertEqual(r["launch"], "NO_GO")
        self.assertIn("unverified_external_fence", r["blockers"])

    def test_negative_gates(self):
        for role in ("app", "redis"):
            for field, value, reason in (("running", True, role + "_running"),
                                         ("restart", "always", role + "_auto_restart"),
                                         ("external_ports", [{"port": 1234, "wildcard": True}], role + "_external_ports")):
                with self.subTest(role=role, field=field):
                    o = fixture(); o["containers"][role][field] = value
                    self.assertIn(reason, c.evaluate(o)["blockers"])
        for mutate, reason in ((lambda o: o["containers"].pop("redis"), "redis_missing"),
                               (lambda o: o.update(old_database="wrong"), "old_database_mismatch"),
                               (lambda o: o.update(candidate=None), "candidate_not_configured"),
                               (lambda o: o.update(baseline_match=False), "baseline_projection_changed"),
                               (lambda o: o["candidate"].update(database=c.OLD_DATABASE), "shared_database_namespace"),
                               (lambda o: o["candidate"].update(network_ids=["b" * 64]), "shared_network_namespace"),
                               (lambda o: o["containers"]["app"].update(identity=None), "app_unknown_identity")):
            o = fixture(); mutate(o)
            self.assertIn(reason, c.evaluate(o)["blockers"])

    def test_fabricated_attestations_ignored(self):
        o = fixture()
        o.update(isolated=True, writers_drained=True, provider_routing_verified=True,
                 external_fence=True, operational_pass=True)
        r = c.evaluate(o)
        self.assertEqual(r["launch"], "NO_GO")
        self.assertIn("unverified_external_fence", r["blockers"])
        self.assertEqual(r["structural_readiness"], "observed_prerequisites_only")

    def test_missing_evidence_fail_closed(self):
        o = fixture(); o.update(scan_complete=False, baseline_match=None)
        r = c.evaluate(o)
        self.assertIn("old_native_scan_unverified", r["blockers"])
        self.assertIn("baseline_unavailable", r["blockers"])
        self.assertEqual(r["exit_code"], 3)

    def test_inspect_sanitizes_and_rejects_identity(self):
        raw = {"Name": "/" + c.OLD_NAMES["app"], "Id": c.OLD_IDENTITIES["app"],
               "State": {"Running": False}, "Config": {"Env": ["SECRET=do-not-emit"]},
               "Mounts": [{"Source": "/private-secret"}],
               "HostConfig": {"RestartPolicy": {"Name": "no"}, "NetworkMode": "bridge"},
               "NetworkSettings": {"Ports": {"9000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "9000"}]},
                                   "Networks": {"private-label": {"NetworkID": "b" * 64}}}}
        p = c.project_container(raw, "app")
        self.assertNotIn("SECRET", json.dumps(p)); self.assertNotIn("private", json.dumps(p))
        self.assertTrue(p["external_ports"])
        for key, value in (("Name", "/unexpected"), ("Id", "not-an-identity"), ("Id", "e" * 64)):
            bad = copy.deepcopy(raw); bad[key] = value
            with self.assertRaises(c.IsolationBlocked): c.project_container(bad, "app")

    def test_full_exact_fingerprint_no_filtering(self):
        x = {"rows": [{"a": Decimal("0.12345678901234567890123456789"), "quarantine": ["q"]}],
             "counts": {"payment": 1, "refund": 0}, "issues": ["unfinished"]}
        self.assertEqual(c.fingerprint(x), c.fingerprint(copy.deepcopy(x)))
        for k, v in (("rows", []), ("counts", {"payment": 2}), ("issues", [])):
            y = copy.deepcopy(x); y[k] = v
            self.assertNotEqual(c.fingerprint(x), c.fingerprint(y))
        y = copy.deepcopy(x); y["rows"][0]["a"] += Decimal("0.00000000000000000000000000001")
        self.assertNotEqual(c.fingerprint(x), c.fingerprint(y))

    def test_exclusive_private_output(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "report.json"
            c.emit(c.evaluate({}), p)
            self.assertEqual(p.stat().st_mode & 0o777, 0o600)
            original = p.read_bytes()
            with self.assertRaises(FileExistsError): c.emit(c.evaluate({}), p)
            self.assertEqual(p.read_bytes(), original)
            link = Path(d) / "link"; link.symlink_to(p)
            with self.assertRaises(FileExistsError): c.emit(c.evaluate({}), link)

    def test_bounded_subprocess(self):
        with self.assertRaises(c.IsolationBlocked):
            c.bounded_run([sys.executable, "-c", "print('x'*10000)"], limit=100)
        with self.assertRaises(c.IsolationBlocked):
            c.bounded_run([sys.executable, "-c", "import time;time.sleep(2)"], timeout=.05)

    def test_shared_container_namespace_not_blank_network_acceptance(self):
        raw = {"Name": "/" + c.OLD_NAMES["app"], "Id": c.OLD_IDENTITIES["app"],
               "State": {"Running": True},
               "HostConfig": {"RestartPolicy": {"Name": "no"}, "NetworkMode": "container:" + "d" * 64},
               "NetworkSettings": {"Ports": {}, "Networks": {}}}
        p = c.project_container(raw, "app")
        self.assertTrue(p["unsafe_network_mode"])
        self.assertFalse(p["ports_complete"])
        o = fixture(); o["containers"]["app"] = p
        r = c.evaluate(o)
        self.assertIn("app_running", r["blockers"])
        self.assertIn("app_shared_network_mode", r["blockers"])
        self.assertIn("app_namespace_ports_unverified", r["blockers"])
        self.assertNotIn("app_missing", r["blockers"])

    def test_bounded_subprocess_stderr_and_input(self):
        with self.assertRaises(c.IsolationBlocked):
            c.bounded_run([sys.executable, "-c", "import sys;sys.stderr.write('x'*10000)"], limit=100)
        with self.assertRaises(c.IsolationBlocked):
            c.bounded_run([sys.executable, "-c", "pass"], input="x" * 100001)
        r = c.bounded_run([sys.executable, "-c", "import sys;print(len(sys.stdin.read()))"], input="x" * 50000)
        self.assertEqual(r.stdout.strip(), "50000")

    def test_cli_exclusive_failure_exit3_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "existing.json"; p.write_bytes(b"retained")
            r = subprocess.run([sys.executable, "-m", "scripts.reconciliation.isolation_check",
                                "--output", str(p)], capture_output=True, text=True, timeout=105)
            self.assertEqual(r.returncode, 3)
            self.assertEqual(p.read_bytes(), b"retained")
            self.assertEqual(json.loads(r.stdout)["status"], "isolation_not_established")
            self.assertNotIn(str(p), r.stdout + r.stderr)
            self.assertEqual(r.stderr, "")

    def test_no_arbitrary_discovery_or_state_controls(self):
        for flag in ("--runtime", "--container", "--candidate", "--revoke", "--config", "--test-only"):
            with self.subTest(flag=flag):
                r = subprocess.run([sys.executable, "-m", "scripts.reconciliation.isolation_check",
                                    flag, "secret-not-echoed"], capture_output=True, text=True, timeout=5)
                self.assertEqual(r.returncode, 3)
                self.assertEqual(json.loads(r.stdout)["launch"], "NO_GO")
                self.assertNotIn("secret", r.stdout + r.stderr)

    def test_cli_rejects_untrusted_inputs_sanitized(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "result.json"
            r = subprocess.run([sys.executable, "-m", "scripts.reconciliation.isolation_check",
                                "--attestation", "secret-synthetic", "--output", str(p)],
                               capture_output=True, text=True, timeout=5)
            self.assertEqual(r.returncode, 3)
            self.assertEqual(json.loads(r.stdout)["launch"], "NO_GO")
            self.assertNotIn("secret", r.stdout + r.stderr)


class ReviewRegressions(unittest.TestCase):
    def private_probe(self, reader, raw, before, after, **extra):
        class Stream(io.BytesIO):
            def fileno(self): return 123
        with patch.object(c.os, "open", return_value=123), \
             patch.object(c.os, "fdopen", return_value=Stream(raw)), \
             patch.object(c.os, "fstat", side_effect=[before, after]):
            with self.assertRaises(c.IsolationBlocked): reader(**extra)

    def info(self, size, **changes):
        fields = dict(st_mode=0o100600, st_uid=os.getuid(), st_size=size,
                      st_dev=1, st_ino=2, st_mtime_ns=3, st_ctime_ns=4)
        fields.update(changes)
        return SimpleNamespace(**fields)

    def test_baseline_valid_truncation_rejected(self):
        raw = json.dumps(dict.fromkeys(("completion_semantics", "counts", "issues", "payments", "scope", "status"))).encode()
        self.private_probe(c.read_baseline, raw, self.info(len(raw)+10), self.info(len(raw)+10))

    def test_baseline_growth_and_stat_changes_rejected(self):
        raw = json.dumps(dict.fromkeys(("completion_semantics", "counts", "issues", "payments", "scope", "status"))).encode()
        self.private_probe(c.read_baseline, raw, self.info(len(raw)-1), self.info(len(raw)-1))
        for field, value in (("st_size", len(raw)+1), ("st_ino", 8), ("st_dev", 9),
                             ("st_mtime_ns", 10), ("st_ctime_ns", 11)):
            with self.subTest(field=field):
                self.private_probe(c.read_baseline, raw, self.info(len(raw)), self.info(len(raw), **{field: value}))

    def test_runtime_truncate_grow_changed_and_oversize_rejected(self):
        raw = json.dumps(dict(db=c.OLD_DATABASE, pg=c.OLD_NAMES["postgres"], app=c.OLD_NAMES["app"])).encode()
        for size in (len(raw)+10, len(raw)-1, 65537):
            with self.subTest(size=size):
                self.private_probe(c.read_runtime, raw, self.info(size), self.info(size))
        for field, value in (("st_ino", 8), ("st_mtime_ns", 10), ("st_size", len(raw)+1)):
            self.private_probe(c.read_runtime, raw, self.info(len(raw)), self.info(len(raw), **{field: value}))

    def test_private_caps_exact_mode_and_regular_required(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "private.json"; p.write_bytes(b"{}")
            p.chmod(0o600)
            with patch.object(c, "BASELINE", p), patch.object(c, "MAX_JSON", 1):
                with self.assertRaises(c.IsolationBlocked): c.read_baseline()
            for mode in (0o400, 0o640, 0o700):
                p.chmod(mode)
                with patch.object(c, "OLD_RUNTIME", p):
                    with self.assertRaises(c.IsolationBlocked): c.read_runtime()
            link = Path(d) / "link"; link.symlink_to(p)
            with patch.object(c, "OLD_RUNTIME", link):
                with self.assertRaises(c.IsolationBlocked): c.read_runtime()
            with patch.object(c, "OLD_RUNTIME", Path(d)):
                with self.assertRaises(c.IsolationBlocked): c.read_runtime()

    def acquisition(self, *, replace_after=False, schema_changed=False, snapshot_changed=False, substitute_runtime=False):
        raw = []
        for role, name in c.OLD_NAMES.items():
            raw.append(dict(Name="/"+name, Id=c.OLD_IDENTITIES[role], State=dict(Running=True),
                HostConfig=dict(RestartPolicy=dict(Name="no"), NetworkMode="bridge"),
                NetworkSettings=dict(Ports={}, Networks=dict(n=dict(NetworkID="b"*64)))))
        schema = []
        for table, fields in c.db.FIELDS.items():
            for field in fields.split() + (["data"] if table == "payment" else []):
                kind = "jsonb" if field.startswith("raw_") or field in ("data", "totals", "plan", "snapshot") else "integer" if field == "version" else "numeric" if field == "amount" or field.endswith("_amount") else "text"
                schema.append(dict(table_name=table, column_name=field, data_type=kind))
        snapshot = {t: [] for t in c.db.FIELDS}
        calls = []; inspections = 0
        def runner(command, **kwargs):
            nonlocal inspections
            calls.append((command, kwargs))
            if command[:2] == ["docker", "inspect"]:
                inspections += 1
                inspected = copy.deepcopy(raw)
                if replace_after and inspections > 1: inspected[-1]["Id"] = "e"*64
                return subprocess.CompletedProcess(command, 0, json.dumps(inspected), "")
            is_data = "'snapshot'" in kwargs["input"]
            value = dict(schema=schema, snapshot=snapshot) if is_data else schema
            if is_data and schema_changed: value = dict(schema=schema[:-1], snapshot=snapshot)
            if is_data and snapshot_changed: value = dict(schema=schema, snapshot={})
            if not is_data and substitute_runtime:
                # Only a disposable fixture is replaced, never the real runtime.
                p.write_text(json.dumps(dict(db="unknown", pg="unknown", app="unknown")))
            return subprocess.CompletedProcess(command, 0, json.dumps(value), "")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "state.json"
            p.write_text(json.dumps(dict(db=c.OLD_DATABASE, pg=c.OLD_NAMES["postgres"], app=c.OLD_NAMES["app"])))
            p.chmod(0o600)
            baseline = c.db.ledger_report(dict(rows=[], counts={t: 0 for t in snapshot}, issues=[]))
            with patch.object(c, "OLD_RUNTIME", p), patch.object(c, "bounded_run", side_effect=runner), \
                 patch.object(c, "read_baseline", return_value=(baseline, "a"*64)):
                report = c.ReadOnlyAcquisition().acquire()
        return report, calls

    def test_inspect_exec_name_rebind_cannot_redirect_target(self):
        report, calls = self.acquisition()
        self.assertEqual(report["acquisition_errors"], [])
        execs = [cmd for cmd, kwargs in calls if cmd[:2] == ["docker", "exec"]]
        self.assertEqual(len(execs), 2)
        for command in execs: self.assertEqual(command[3], c.OLD_IDENTITIES["postgres"])
        for command, kwargs in calls:
            if command[:2] == ["docker", "exec"]:
                self.assertTrue(kwargs["input"].startswith("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"))
                self.assertTrue(kwargs["input"].endswith("ROLLBACK;\n"))
        self.assertTrue(report["observations"]["saved_ledger_comparison"]["matches"])

    def test_unknown_replacement_after_native_read_rejected(self):
        report, _ = self.acquisition(replace_after=True)
        self.assertTrue(report["acquisition_errors"])
        self.assertEqual(report["exit_code"], 3)

    def test_schema_recheck_and_whole_projection_required(self):
        for change in (dict(schema_changed=True), dict(snapshot_changed=True)):
            report, _ = self.acquisition(**change)
            self.assertEqual(report["exit_code"], 3)
            self.assertTrue(report["acquisition_errors"])

    def test_runtime_substitution_cannot_redirect_and_is_rejected(self):
        report, calls = self.acquisition(substitute_runtime=True)
        self.assertEqual(report["exit_code"], 3)
        execs = [cmd for cmd, _ in calls if cmd[:2] == ["docker", "exec"]]
        self.assertEqual(len(execs), 2)
        for command in execs:
            self.assertEqual(command[3], c.OLD_IDENTITIES["postgres"])
            self.assertEqual(command[14], c.OLD_DATABASE)

    def test_pinned_runner_rejects_wrong_command_sql_and_kwargs(self):
        command = ["docker", "exec", "-i", c.OLD_NAMES["postgres"], "psql", "-X", "-qAt", "-h", "/var/run/postgresql", "-p", "5432", "-U", "gate", "-d", c.OLD_DATABASE, "-v", "ON_ERROR_STOP=1"]
        sql = c.db._schema_sql()
        script = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='3s';\n" + sql + ";\nROLLBACK;\n"
        kwargs = dict(input=script, text=True, capture_output=True, timeout=45, check=False)
        with self.assertRaises(c.IsolationBlocked): c.pinned_runner("DELETE FROM payment")
        guard = c.pinned_runner(sql)
        with patch.object(c, "bounded_run") as run:
            for index, value in ((3, "e"*64), (14, "unknown"), (1, "stop")):
                bad = list(command); bad[index] = value
                with self.assertRaises(c.IsolationBlocked): guard(bad, **kwargs)
            for change in (dict(input="DELETE FROM payment;"), dict(timeout=99), dict(shell=True)):
                with self.assertRaises(c.IsolationBlocked): guard(command, **{**kwargs, **change})
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
