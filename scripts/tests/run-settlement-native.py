#!/usr/bin/env python3
"""Run native SDK/ORM contract checks in a pinned, offline dependency image.

No application entrypoint, live services, host ports, installs or migrations.
Mounted candidate source is read-only. Container identity matches source ownership.
This is not a full backend typecheck or payment lifecycle test.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = 'sha256:7cb352c5130e6661e8ad470535845a1fa593b6d56619632343046d4d033464e1'
parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['contracts', 'graphs', 'serialization', 'all'], default='all')
parser.add_argument('--output-dir', type=Path, default=Path('/home/hermes/audits/hobbysalon-commerce-fixes-20261002/logs'))
args = parser.parse_args()
args.output_dir.mkdir(parents=True, exist_ok=True)
modes = ['contracts', 'graphs', 'serialization'] if args.mode == 'all' else [args.mode]
results = []
for mode in modes:
    name = 'settlement-native-parent-' + uuid.uuid4().hex[:12]
    cmd = ['docker', 'run', '--name', name, '--pull=never', '--network', 'none', '--read-only', '--ulimit', 'core=0:0',
           '--user', f'{os.getuid()}:{os.getgid()}', '--memory', '192m', '--memory-swap', '192m',
           '--cpus', '0.75', '--pids-limit', '64', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
           '--entrypoint', 'node', '-w', '/app/apps/backend']
    for source, target in [
        ('packages/modules/b2c-core/src', 'audit-src'), ('packages/modules/requests/src', 'audit-requests'),
        ('packages/framework/src', 'audit-framework'), ('scripts/tests/helpers/settlement-native.cjs', 'settlement-native.cjs')]:
        cmd += ['-v', f'{ROOT / source}:/app/apps/backend/{target}:ro']
    cmd += [IMAGE, '--max-old-space-size=128', 'settlement-native.cjs', mode]
    entry = {'mode': mode, 'command': cmd, 'started_at_epoch': time.time(), 'exit_code': None,
             'helper_sha256': hashlib.sha256((ROOT / 'scripts/tests/helpers/settlement-native.cjs').read_bytes()).hexdigest()}
    try:
        proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=65)
        log = args.output_dir / f'parent-native-{mode}.log'
        log.write_text(proc.stdout)
        entry.update(exit_code=proc.returncode, log=str(log))
        final = [line.split('=', 1)[1] for line in proc.stdout.splitlines() if line.startswith('NATIVE_AUDIT_JSON=')]
        if len(final) == 1:
            entry['result'] = json.loads(final[0])
        checks = entry.get('result', {}).get('checks', [])
        entry['passed'] = proc.returncode == 0 and bool(checks) and all(item['status'] == 'PASS' for item in checks)
        print(mode, 'exit', proc.returncode, 'passed', entry['passed'], flush=True)
        for check in checks:
            print(json.dumps(check), flush=True)
        if not checks:
            print(proc.stdout[-2500:], flush=True)
    except Exception as exc:
        entry.update(passed=False, error=str(exc))
        print('BLOCKED', mode, str(exc), flush=True)
    finally:
        cleaned = subprocess.run(['docker', 'rm', '-f', name], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=20)
        gone = subprocess.run(['docker', 'container', 'inspect', name], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=20)
        entry['cleanup_verified'] = cleaned.returncode == 0 and gone.returncode != 0 and 'No such' in gone.stdout
        entry['passed'] = entry.get('passed', False) and entry['cleanup_verified']
        results.append(entry)
        (args.output_dir / f'parent-native-{mode}.json').write_text(json.dumps(entry, indent=2) + '\n')
raise SystemExit(0 if all(result['passed'] for result in results) else 1)
