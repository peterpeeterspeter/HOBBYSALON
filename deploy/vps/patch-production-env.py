#!/usr/bin/env python3
"""Patch /opt/hobbysalon/deploy/vps/.env on the VPS without printing secrets."""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        values[key.strip()] = value
    return values


def merge_cors(existing: str, origin: str) -> str:
    parts = [part.strip() for part in existing.split(",") if part.strip()]
    if origin not in parts:
        parts.append(origin)
    return ",".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="23.95.148.204")
    parser.add_argument("--env-file", default="/opt/hobbysalon/deploy/vps/.env")
    parser.add_argument("--storefront-env", default="../../apps/storefront/.env.local")
    parser.add_argument("--backend-env", default="../../apps/backend/.env")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    storefront = load_dotenv((script_dir / args.storefront_env).resolve())
    backend = load_dotenv((script_dir / args.backend_env).resolve())

    updates: dict[str, str] = {}

    supabase_url = storefront.get("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_anon = storefront.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    service_role = (
        storefront.get("SUPABASE_SERVICE_ROLE_KEY")
        or backend.get("SUPABASE_SERVICE_ROLE_KEY")
        or backend.get("PLATFORM_SUPABASE_SERVICE_ROLE_KEY")
        or ""
    )

    if supabase_url:
        updates["PLATFORM_SUPABASE_URL"] = supabase_url
    if supabase_anon:
        updates["PLATFORM_SUPABASE_ANON_KEY"] = supabase_anon
    if service_role:
        updates["PLATFORM_SUPABASE_SERVICE_ROLE_KEY"] = service_role

    updates["VENDOR_PANEL_URL"] = "https://verkoper.hobbysalon.be"
    updates["VENDOR_CORS"] = "https://verkoper.hobbysalon.be"

    for key in (
        "STRIPE_SECRET_API_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PAYMENT_WEBHOOK_SECRET",
        "STRIPE_CONNECTED_ACCOUNTS_WEBHOOK_SECRET",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
    ):
        value = backend.get(key)
        if value and "dummy" not in value and value != "noreply@example.com":
            updates[key] = value

    payload = base64.b64encode(json.dumps(updates).encode("utf-8")).decode("ascii")
    remote = f"""python3 - <<'PY'
import base64, json, pathlib, re
env_path = pathlib.Path({args.env_file!r})
updates = json.loads(base64.b64decode({payload!r}).decode('utf-8'))
text = env_path.read_text() if env_path.exists() else ''
lines = text.splitlines()
data = {{}}
order = []
for line in lines:
    if not line.strip() or line.strip().startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    if key not in data:
        order.append(key)
    data[key] = value
verkoper = 'https://verkoper.hobbysalon.be'
if 'AUTH_CORS' in data:
    parts = [p.strip() for p in data['AUTH_CORS'].split(',') if p.strip()]
    if verkoper not in parts:
        parts.append(verkoper)
    data['AUTH_CORS'] = ','.join(parts)
else:
    data['AUTH_CORS'] = verkoper
    order.append('AUTH_CORS')
for key, value in updates.items():
    if key not in data:
        order.append(key)
    data[key] = value
out = []
seen = set()
for key in order:
    if key in data and key not in seen:
        out.append(f'{{key}}={{data[key]}}')
        seen.add(key)
for key, value in data.items():
    if key not in seen:
        out.append(f'{{key}}={{value}}')
        seen.add(key)
env_path.write_text('\\n'.join(out) + '\\n')
env_path.chmod(0o600)
print('patched', len(updates), 'keys')
missing = [k for k in ['PLATFORM_SUPABASE_URL','PLATFORM_SUPABASE_ANON_KEY','PLATFORM_SUPABASE_SERVICE_ROLE_KEY'] if not data.get(k)]
if missing:
    print('missing', ','.join(missing))
PY"""

    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", f"root@{args.host}", remote],
        check=False,
        capture_output=True,
        text=True,
    )
    sys.stdout.write(result.stdout)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
