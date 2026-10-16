"""Detached test-only candidate. No public apply, CLI, provider or DB connector.
Execution lives exclusively in the opt-in isolated PostgreSQL fixture. Capabilities
are independently provisioned by its trusted owner, never verified booleans.
"""
from dataclasses import dataclass
import hashlib
import json
from decimal import Decimal, InvalidOperation


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


@dataclass(frozen=True)
class NoEffectCandidate:
    operation_id: str
    snapshot_json: str
    snapshot_sha256: str
    terminal_result: str = "NO-EFFECT"
    financial_obligation: str = "unchanged_unresolved"
    runtime_success: bool = False

    def snapshot(self):
        return json.loads(self.snapshot_json)

    def validate_integrity(self):
        payload = _canonical({"operation_id": self.operation_id, "snapshot": json.loads(self.snapshot_json)})
        if (hashlib.sha256(payload.encode()).hexdigest() != self.snapshot_sha256
                or self.terminal_result != "NO-EFFECT"
                or self.financial_obligation != "unchanged_unresolved" or self.runtime_success is not False):
            raise ValueError("snapshot/identity/semantics tamper")
        return True


def inspect_isolated_snapshot(operation_id, snapshot):
    # Detached scope/shape check only; never execution authority or full native acceptance.
    if not isinstance(snapshot, dict) or not isinstance(operation_id, str) or not operation_id:
        raise ValueError('identity/shape')
    rows = snapshot.get("refund_settlement", [])
    if len(rows) != 1 or rows[0].get("operation_id") != operation_id:
        raise ValueError("identity")
    row = rows[0]
    plan = row.get("plan", {})
    if (row.get("phase") != "refund_started" or row.get("no_effect_receipt_id") is not None
            or row.get('reversal_receipt_id') is not None):
        raise ValueError("terminal/phase")
    try:
        amount = Decimal(str(plan.get('customerRefund')))
        if not amount.is_finite() or amount <= 0:
            raise ValueError('customer refund')
    except InvalidOperation as exc:
        raise ValueError('customer refund') from exc
    if plan.get("sellerReversal") != 0 or plan.get("payout_id") is not None:
        raise ValueError("unsupported reversal")
    if snapshot.get("refund") or snapshot.get("commerce_refund_dispatch"):
        raise ValueError("reservation/dispatch unsupported")
    serialized = _canonical(snapshot)
    payload = _canonical({"operation_id": operation_id, "snapshot": snapshot})
    return NoEffectCandidate(operation_id, serialized, hashlib.sha256(payload.encode()).hexdigest())
