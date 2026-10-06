"""Stdlib read-only reconciliation CLI. No scheduling, mutation or repair apply.

check config (owner-only 0600 JSON):
  {"runtimes": ["/path/old", "/path/fixed"],
   "stripe": {"restricted_key_file": "/private/key", "livemode": false,
              "readonly_attested": true, "attestation_reference": "external review reference",
              "expected_account_id": "acct_<independently verified account>"}}
The key file must contain a real restricted rk_test key and be owner-only 0600.
Never configure an sk_test key. Missing credentials fail BEFORE Docker or HTTP.
Daily command ready: python3 -m scripts.reconciliation check --config /private/config
No scheduler is installed or enabled. Repair projections are NOT complete raw
snapshots: optional repair planning remains blocked, never fabricates evidence.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import stat
import sys

from .db_readonly import DBReadBlocked, SANDBOXES, private_json, validate_runtime, scan_runtime, ledger_report
from .comparison import ComparisonBlocked, compare
from .stripe_readonly import StripeReadBlocked, StripeReadOnly, identifier


def _private_key(path):
    try:
        fd = os.open(Path(path).expanduser(), os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "r", encoding="utf-8") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > 4096:
                raise DBReadBlocked("private_key_file_required")
            return stream.read().strip()
    except DBReadBlocked:
        raise
    except Exception:
        raise DBReadBlocked("restricted_key_file_required") from None


def check_config(path):
    config = private_json(path)
    stripe = config.get("stripe")
    if not isinstance(stripe, dict) or not stripe.get("restricted_key_file"):
        raise DBReadBlocked("restricted_key_and_external_attestation_required")
    if stripe.get("livemode") is not False:
        raise DBReadBlocked("production_provider_refused")
    reader = StripeReadOnly(_private_key(stripe["restricted_key_file"]), livemode=False,
                          readonly_attested=stripe.get("readonly_attested", False),
                          attestation_reference=stripe.get("attestation_reference", ""))
    runtimes = config.get("runtimes")
    if not isinstance(runtimes, list) or len(runtimes) != 2:
        raise DBReadBlocked("both_sandbox_runtimes_required")
    validated = [validate_runtime(r) for r in runtimes]
    if {r["db"] for r in validated} != set(SANDBOXES):
        raise DBReadBlocked("both_distinct_test_databases_required")
    expected_account = identifier(stripe.get("expected_account_id"), "acct")
    return reader, runtimes, expected_account


def run_check(path):
    reader, runtimes, expected_account = check_config(path)
    account = reader.read_account(expected_account_id=expected_account)
    provider = reader.scan()
    provider["account_id"] = account["id"]
    provider["request_hashes"].insert(0, account["request_hash"])
    scans = [scan_runtime(runtime) for runtime in runtimes]
    # PIs in either DB belong to the test inventory; compare account-only PIs once
    # globally so a payment in DB A is not falsely "unknown" in DB B.
    known = {row["payment_intent"] for scan in scans for row in scan["rows"]}
    global_result = compare(provider, [row for scan in scans for row in scan["rows"]]) if len(known) == sum(len(s["rows"]) for s in scans) else None
    results = []
    for scan in scans:
        local_ids = {r["payment_intent"] for r in scan["rows"]}
        charges = [c for c in provider["charges"] if c["payment_intent"] in local_ids]
        charge_ids = {c["id"] for c in charges}
        subset = {**provider, "charges": charges, "refunds": [r for r in provider["refunds"] if r["payment_intent"] in local_ids or r["charge"] in charge_ids]}
        result = compare(subset, scan["rows"], native_complete=scan["complete"])
        result["database"] = scan["database"]
        result["counts"] = scan["counts"]
        result["native_scan_issues"] = scan["issues"]
        results.append(result)
    # Separate global provider inventory comparison covers unknown charges/refunds.
    if global_result is None:
        raise DBReadBlocked("duplicate_payment_intent_across_test_databases")
    clean = global_result["clean"] and all(r["clean"] and not r["native_scan_issues"] for r in results)
    return {"status": "clean" if clean else "discrepancy", "scope": provider["scope"],
            "provider_counts": {k: len(provider[k]) for k in ("charges", "refunds", "events")},
            "provider_request_hashes": provider["request_hashes"], "databases": results,
            "inventory_discrepancies": [d for d in global_result["discrepancies"] if d["code"].startswith("provider_")],
            "repair": {"status": "blocked", "reason": "complete_raw_snapshot_and_independent_schema_approval_required", "apply_supported": False},
            "caveat": "Stripe-scan is niet atomair; externe writer-fence nodig voor acceptatie. Events zijn retentiegebonden."}


def _emit(report, output):
    encoded = json.dumps(report, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    if output:
        # Exclusive create refuses existing files and symlinks; never overwrite a key.
        fd = os.open(Path(output).expanduser(), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(encoded)
    print(encoded, end="")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Alleen-lezen reconciliatie van toegestane testdatabases; geen reparaties of planning.", epilog="Dagelijks configureerbaar: check --config /privé/config.json. Niet ingepland. Exit: 0 schoon, 2 verschil/onvoltooid, 3 geblokkeerd.")
    commands = parser.add_subparsers(dest="command", required=True)
    ledger = commands.add_parser("ledger", help="Volledige lokale grootboekscan; geen Stripe-aanroepen")
    ledger.add_argument("--runtime", required=True, help="Privé runtime-map of state.json")
    ledger.add_argument("--output", help="Nieuw veilig JSON-rapport (0600)")
    check = commands.add_parser("check", help="Volledige Stripe GET-scan en beide testdatabases vergelijken")
    check.add_argument("--config", required=True, help="Privé JSON-configuratie (0600)")
    check.add_argument("--output", help="Nieuw veilig JSON-rapport (0600)")
    args = parser.parse_args(argv)
    try:
        report = ledger_report(scan_runtime(args.runtime)) if args.command == "ledger" else run_check(args.config)
        _emit(report, args.output)
        return 0 if report["status"] == "clean" else 2
    except (DBReadBlocked, ComparisonBlocked, StripeReadBlocked):
        # Never reflect arbitrary provider/DB exception text, config values or paths.
        print(json.dumps({"status": "blocked", "message": "Geblokkeerd: controleer privéconfiguratie, testscope, attestatie en volledig financieel schema."}))
        return 3
    except Exception:
        print(json.dumps({"status": "blocked", "message": "Geblokkeerd: veilige alleen-lezen controle of rapportuitvoer mislukt."}))
        return 3


if __name__ == "__main__":
    sys.exit(main())
