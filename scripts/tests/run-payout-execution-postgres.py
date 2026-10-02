#!/usr/bin/env python3
"""Isolated real PostgreSQL payout acceptance. Synthetic effects only; no providers/native purchases.
Exit 0 requires exact named suite, source binding and verified cleanup. 1 failure, 2 resource/startup block.
"""
import argparse
import copy
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
SOURCE = REPO / 'packages/modules/b2c-core/src'
HELPER = REPO / 'scripts/tests/helpers/payout-execution-postgres.cjs'
BACKEND = 'sha256:7cb352c5130e6661e8ad470535845a1fa593b6d56619632343046d4d033464e1'
POSTGRES = 'sha256:97ff59a4e30e08d1c11bdcd9455e7832368c0572b576c9092cde2df4ae5552a3'
LABEL = 'local.audit.payout-execution.owner'
MIB = 1024 * 1024
FILES = ['utils/payout-execution.ts', 'utils/refund-settlement.ts', 'utils/refund-settlement-store.ts', 'modules/payout/migrations/Migration20261002170000.ts', 'modules/split-order-payment/migrations/Migration20261002152627.ts']
EXTRA = {
    'apps/backend/src/utils/commerce-recovery-report.ts': '/app/apps/backend/audit-recovery-report.ts',
    'packages/modules/requests/src/modules/order-return-request/migrations/Migration20261002163000.ts': '/app/apps/backend/audit-native-return-migration.ts',
}
SOURCE_PATHS = {**{f: SOURCE / f for f in FILES}, **{f: REPO / f for f in EXTRA}}
EXPECTED = ['actual_refund_and_payout_migrations', 'started_committed_independent_connection_before_transfer_no_ambient_transaction',
 'completed_replay_fresh_process_no_financial_dispatch', 'crash_after_transfer_before_checkpoint_fresh_process_retry_blocked',
 'link_failure_remains_blocked', 'checkpoint_failure_remains_blocked', 'cross_process_same_collection_payout_holds_refund',
 'cross_process_same_collection_refund_holds_payout', 'different_collections_progress_while_child_holds_lock',
 'unfinished_refund_blocks_payout_including_same_identity', 'pending_payout_blocks_refund_guard',
 *['immutable_' + f for f in ('order_id', 'scope_id', 'plan', 'created_at', 'payout_id', 'transfer_id')],
 'phase_rewind_refused', 'delete_refused', 'truncate_refused_preserves_evidence', 'unique_payout_id', 'unique_transfer_id',
 'same_row_identity_conflict_and_unique_unfinished_scope', 'zero_amount_completes_without_effects', 'real_knex_ambient_transaction_rejected',
 'payout_migration_down_refuses_preserves_evidence',
 'recovery_report_lists_payout_native_refund_checkpoints', 'recovery_report_filters_order_pagination_real_pg_binding',
 'recovery_report_no_leaked_plans_or_database_mutations', 'recovery_report_started_payout_requires_manual_reconciliation',
 'recovery_report_completed_payout_updated_at_nonstale', 'recovery_report_mutated_filters_rejected_without_db_effects']

class Blocked(RuntimeError):
    pass

def require(ok, message):
    if not ok:
        raise RuntimeError(message)

def hashes():
    return {str(p.relative_to(REPO)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [*SOURCE_PATHS.values(), HELPER, Path(__file__).resolve()]}

def runtime_hashes(before):
    return {f: before[str(p.relative_to(REPO))] for f, p in SOURCE_PATHS.items()}

def resources():
    mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    return {'memory_available': int(mem['MemAvailable'].split()[0]) * 1024, 'disk_available': shutil.disk_usage(REPO).free}

def tagged(text, tag):
    return [json.loads(line[len(tag) + 1:]) for line in text.splitlines() if line.startswith(tag + ' ')]

def validate(text, exit_code, before):
    require(exit_code == 0, f'Node exited {exit_code}')
    results, runtime, summaries = (tagged(text, t) for t in ('TEST_RESULT', 'RUNTIME_METADATA', 'PAYOUT_RESULT'))
    require([r.get('name') for r in results] == EXPECTED, 'incomplete/duplicate/reordered inventory')
    require(all(r.get('status') == 'passed' for r in results), 'failed/skipped tests')
    require(len(runtime) == len(summaries) == 1, 'runtime/summary missing or duplicated')
    require(summaries[0] == {'expected': len(EXPECTED), 'passed': len(EXPECTED), 'failed': 0, 'skipped': 0, 'results': results}, 'totals mismatch')
    require(runtime[0]['source_hashes'] == runtime_hashes(before), 'runtime hash mismatch')
    require(runtime[0]['migration_count'] == 3, 'runtime migration count mismatch')
    require(runtime[0]['expected_tests'] == len(EXPECTED), 'runtime count mismatch')
    migrations, downs, crashes = (tagged(text, t) for t in ('MIGRATION_SQL', 'MIGRATION_DOWN_REFUSED', 'CRASH_OBSERVED'))
    require([m['name'] for m in migrations] == ['refund', 'payout', 'native_return'], 'actual migrations missing')
    require(all(m['direction'] == 'up' and isinstance(m['queries'], list) and m['queries'] and all(isinstance(q, str) and q.strip() for q in m['queries']) for m in migrations), 'migration SQL missing')
    require(len(downs) == 1 and downs[0]['emitted_queries'] == 0 and downs[0]['preserved_rows'] > 0, 'permanent migration evidence missing')
    require(len(crashes) == 1 and crashes[0]['signal'] == 'SIGKILL' and crashes[0]['code'] is None, 'crash evidence missing')
    require([r['direction'] for r in tagged(text, 'PROCESS_CONCURRENCY')] == ['payout_holds_refund', 'refund_holds_payout'], 'bidirectional process exclusion missing')
    require(not tagged(text, 'FATAL_ERROR') and not tagged(text, 'CLEANUP_ERROR'), 'helper fatal/cleanup failure')
    return summaries[0]

def wait_ready(probe, clock=time.monotonic, pause=time.sleep, seconds=45):
    deadline = clock() + seconds
    while probe() != 0:
        if clock() >= deadline:
            raise Blocked('PostgreSQL TCP readiness timeout')
        pause(.4)

def owned_label(data, run_id):
    require(data['Config'].get('Labels', {}).get(LABEL) == run_id, 'not owned; refusing removal')

def controls():
    # Behavioral no-launch controls; malformed ownership must never authorize cleanup.
    owned_label({'Config': {'Labels': {LABEL: 'owned'}}}, 'owned')
    for labels in ({}, {LABEL: 'other'}):
        try:
            owned_label({'Config': {'Labels': labels}}, 'owned')
        except RuntimeError:
            continue
        raise RuntimeError('cleanup ownership control failed')
    ticks = iter([0, 2])
    try:
        wait_ready(lambda: 1, clock=lambda: next(ticks), pause=lambda _: None, seconds=1)
    except Blocked:
        pass
    else:
        raise RuntimeError('readiness accepted unavailable server')
    wait_ready(lambda: 0)
    return ['cleanup_missing_label_rejected', 'cleanup_wrong_label_rejected', 'tcp_readiness_timeout_rejected', 'tcp_readiness_success_accepted']

def receipt_controls(text, code, before):
    # These run even on RED; no synthetic receipt is represented as product evidence.
    mutations = ['', '\n'.join(l for l in text.splitlines() if not l.startswith('TEST_RESULT ')), text + '\n' + next((l for l in text.splitlines() if l.startswith('TEST_RESULT ')), 'TEST_RESULT {}')]
    for candidate, status in [*[(m, 0) for m in mutations], (text, 1)]:
        try:
            validate(candidate, status, before)
        except (RuntimeError, KeyError, ValueError, TypeError):
            continue
        raise RuntimeError('invalid receipt accepted')
    if code == 0:
        lines = text.splitlines()
        for tag in ['PAYOUT_RESULT', 'RUNTIME_METADATA']:
            changed = []
            for line in lines:
                if line.startswith(tag + ' '):
                    data = json.loads(line[len(tag)+1:])
                    if tag == 'PAYOUT_RESULT':
                        data['passed'] = 0
                    else:
                        data['source_hashes'] = {}
                    line = tag + ' ' + json.dumps(data)
                changed.append(line)
            try:
                validate('\n'.join(changed), 0, before)
            except (RuntimeError, KeyError, ValueError, TypeError):
                continue
            raise RuntimeError('altered receipt accepted')
    return 'passed'

def self_test():
    """Parser unit fixtures only: this mode does not execute PostgreSQL or claim acceptance."""
    before = hashes()
    results = [{'name': name, 'status': 'passed', 'ms': 0} for name in EXPECTED]
    summary = {'expected': len(EXPECTED), 'passed': len(EXPECTED), 'failed': 0, 'skipped': 0, 'results': results}
    entries = [('TEST_RESULT', r) for r in results]
    entries += [('RUNTIME_METADATA', {'source_hashes': runtime_hashes(before), 'migration_count': 3, 'expected_tests': len(EXPECTED)}), ('PAYOUT_RESULT', summary)]
    entries += [('MIGRATION_SQL', {'name': name, 'direction': 'up', 'queries': ['PARSER UNIT FIXTURE, NOT EXECUTED SQL']}) for name in ('refund', 'payout', 'native_return')]
    entries += [('MIGRATION_DOWN_REFUSED', {'emitted_queries': 0, 'preserved_rows': 1}), ('CRASH_OBSERVED', {'signal': 'SIGKILL', 'code': None})]
    entries += [('PROCESS_CONCURRENCY', {'direction': direction}) for direction in ('payout_holds_refund', 'refund_holds_payout')]
    encode = lambda data: '\n'.join(tag + ' ' + json.dumps(value) for tag, value in data)
    text = encode(entries)
    require(validate(text, 0, before) == summary, 'positive parser unit fixture failed')
    receipt_controls(text, 0, before)
    rejected = []
    mutations = {
        'reordered_inventory': [('TEST_RESULT', r) for r in reversed(results)] + [entry for entry in entries if entry[0] != 'TEST_RESULT'],
        'missing_migration': [entry for entry in entries if entry[0] != 'MIGRATION_SQL'],
        'missing_native_migration': [entry for entry in entries if not (entry[0] == 'MIGRATION_SQL' and entry[1]['name'] == 'native_return')],
        'missing_recovery_case': [entry for entry in entries if not (entry[0] == 'TEST_RESULT' and entry[1]['name'].startswith('recovery_report_'))],
        'wrong_migration_count': [(tag, {**value, 'migration_count': 2} if tag == 'RUNTIME_METADATA' else value) for tag, value in entries],
        'missing_added_source_hash': [(tag, {**value, 'source_hashes': {k: v for k, v in value['source_hashes'].items() if k not in EXTRA}} if tag == 'RUNTIME_METADATA' else value) for tag, value in entries],
        'missing_crash': [entry for entry in entries if entry[0] != 'CRASH_OBSERVED'],
        'missing_concurrency': [entry for entry in entries if entry[0] != 'PROCESS_CONCURRENCY'],
        'duplicate_summary': entries + [('PAYOUT_RESULT', summary)],
    }
    for name, altered in mutations.items():
        try:
            validate(encode(altered), 0, before)
        except (RuntimeError, KeyError, ValueError, TypeError):
            rejected.append(name)
        else:
            raise RuntimeError('parser accepted ' + name)
    after = hashes(); require(before == after, 'source changed during preflight')
    return {'boundary': 'Parser/runner unit tests ONLY; zero PostgreSQL acceptance cases executed', 'status': 'passed', 'inventory_count': len(EXPECTED), 'runner_controls': controls(), 'receipt_controls': 'passed', 'additional_rejections': rejected, 'source_hashes_before': before, 'source_hashes_after': after}

def run(output):
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / 'runner.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 2
    run_id = uuid.uuid4().hex
    log_path = output / f'payout-execution-postgres.{run_id}.log'
    report = {'run_id': run_id, 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'boundary': 'Real PostgreSQL/Knex/candidate engine; synthetic transfer/link callbacks; NO provider/native purchase acceptance', 'expected_tests': EXPECTED, 'status': 'running', 'cleanup': [], 'containers': {}, 'log': str(log_path)}
    owned = []; log = log_path.open('w', buffering=1)
    def command(args, timeout=30, check=True):
        log.write('COMMAND ' + json.dumps(args) + '\n')
        try:
            done = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        except subprocess.TimeoutExpired as e:
            log.write(e.stdout.decode(errors='replace') if isinstance(e.stdout, bytes) else e.stdout or '')
            raise Blocked('command timeout') from e
        log.write(done.stdout)
        if check and done.returncode:
            raise Blocked(f'command failed {done.returncode}: {args[:3]}')
        return done
    def inspect(name):
        done = command(['docker', 'inspect', name], check=False)
        if done.returncode:
            require('no such object: ' + name in done.stdout.lower(), 'unexpected inspect failure')
            return None
        return json.loads(done.stdout)[0]
    def create(kind, args, image, tail):
        name = f'payout-execution-{kind}-{run_id[:12]}'; owned.append(name)
        command(['docker', 'create', '--name', name, '--label', f'{LABEL}={run_id}', '--pull=never', *args, image, *tail])
        data = inspect(name); require(data is not None, 'fixture vanished'); owned_label(data, run_id)
        host = data['HostConfig']
        require(host['ReadonlyRootfs'] and not host['Privileged'] and not host.get('PortBindings'), 'unsafe container')
        require(host['Memory'] == (128 if kind == 'pg' else 192)*MIB and host['MemorySwap'] == host['Memory'], 'unsafe memory')
        require(any(u['Name'] == 'core' and u['Soft'] == u['Hard'] == 0 for u in host['Ulimits']), 'core dump not disabled')
        require(host['NetworkMode'] == 'none' if kind == 'pg' else host['NetworkMode'] in ('container:' + report['containers']['pg']['id'], 'container:' + report['containers']['pg']['name']), 'unsafe network')
        require(data['Image'] == image and host['PidsLimit'] == 64 and 'no-new-privileges' in host['SecurityOpt'], 'unsafe isolation')
        binds = [m for m in data['Mounts'] if m['Type'] == 'bind']
        require(all(not m['RW'] for m in binds), 'writable mount')
        require({m['Source'] for m in binds} == (set() if kind == 'pg' else {str(SOURCE), str(HELPER), *[str(REPO / f) for f in EXTRA]}), 'unexpected mounts')
        require(all(m['Type'] in ('bind', 'tmpfs') for m in data['Mounts']), 'persistent volume present')
        if kind == 'node':
            require(data['Config']['User'] == f'{os.getuid()}:{os.getgid()}' and data['Config']['Entrypoint'] == ['node'], 'unsafe node identity/entrypoint')
        report['containers'][kind] = {'name': name, 'id': data['Id'], 'isolation_verified': True}
        return name
    def interrupted(signum, _frame):
        raise Blocked(f'interrupted by {signum}')
    previous = {s: signal.signal(s, interrupted) for s in (signal.SIGINT, signal.SIGTERM)}
    exit_code = 2
    try:
        require(len(EXPECTED) == len(set(EXPECTED)), 'duplicate inventory')
        report['runner_negative_controls'] = controls()
        before = hashes(); report['source_hashes_before'] = before; report['resources_before'] = resources()
        if report['resources_before']['memory_available'] < 500*MIB or report['resources_before']['disk_available'] < 500*MIB:
            raise Blocked('need >=500 MiB available RAM and disk; heavy path not started')
        for image in (BACKEND, POSTGRES):
            require(command(['docker', 'image', 'inspect', image, '--format', '{{.Id}}']).stdout.strip() == image, 'image pin mismatch')
        report['images'] = {'backend': BACKEND, 'postgres': POSTGRES}
        common = ['--read-only', '--ulimit', 'core=0:0', '--pids-limit', '64', '--security-opt', 'no-new-privileges']
        pg = create('pg', [*common, '--network', 'none', '--memory', '128m', '--memory-swap', '128m', '--shm-size', '8m', '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m', '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=4m', '--tmpfs', '/tmp:rw,noexec,nosuid,size=8m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust'], POSTGRES, ['postgres', '-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=12', '-c', 'shared_buffers=8MB', '-c', 'work_mem=512kB', '-c', 'maintenance_work_mem=8MB', '-c', 'wal_buffers=1MB', '-c', 'min_wal_size=32MB', '-c', 'max_wal_size=32MB', '-c', 'fsync=on', '-c', 'synchronous_commit=on'])
        command(['docker', 'start', pg])
        wait_ready(lambda: command(['docker', 'exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], timeout=5, check=False).returncode)
        command(['docker', 'exec', pg, 'createdb', '-h', '127.0.0.1', '-U', 'postgres', 'payout_execution_acceptance'])
        target = '/app/apps/backend/payout-execution-postgres.cjs'
        extra_mounts = [arg for f, destination in EXTRA.items() for arg in ('--mount', f'type=bind,source={REPO / f},target={destination},readonly')]
        node = create('node', [*common, '--network', f'container:{pg}', '--memory', '192m', '--memory-swap', '192m', '--user', f'{os.getuid()}:{os.getgid()}', '--cap-drop', 'ALL', '--entrypoint', 'node', '--mount', f'type=bind,source={SOURCE},target=/app/apps/backend/audit-src,readonly', '--mount', f'type=bind,source={HELPER},target={target},readonly', *extra_mounts, '-e', 'PAYOUT_ISOLATED_FIXTURE=1', '-e', 'NODE_OPTIONS='], BACKEND, ['--max-old-space-size=64', target])
        done = command(['docker', 'start', '--attach', node], timeout=180, check=False)
        report['node_exit_code'] = done.returncode; report['results'] = tagged(done.stdout, 'TEST_RESULT'); report['runtime'] = tagged(done.stdout, 'RUNTIME_METADATA'); report['raw_summaries'] = tagged(done.stdout, 'PAYOUT_RESULT')
        report['receipt_negative_controls'] = receipt_controls(done.stdout, done.returncode, before)
        report['summary'] = validate(done.stdout, done.returncode, before)
        report['status'] = 'passed'; exit_code = 0
    except Blocked as e:
        report['status'] = 'blocked'; report['error'] = str(e)
    except Exception as e:
        report['status'] = 'failed'; report['error'] = f'{type(e).__name__}: {e}'; exit_code = 1
    finally:
        for s in previous:
            signal.signal(s, signal.SIG_IGN)
        for name in reversed(owned):
            try:
                data = inspect(name)
                if data:
                    owned_label(data, run_id)
                    state = data['State']; report['cleanup'].append({'name': name, 'state': state})
                    if state.get('OOMKilled'):
                        report['status'] = 'blocked'; report['error'] = 'fixture OOMKilled'; exit_code = 2
                    command(['docker', 'logs', name], check=False)
                    command(['docker', 'rm', '--force', name]); require(inspect(name) is None, 'fixture not removed')
                    report['cleanup'][-1]['removed_and_verified'] = True
                else:
                    report['cleanup'].append({'name': name, 'absent': True})
            except Exception as e:
                report['cleanup'].append({'name': name, 'error': str(e)}); report['status'] = 'cleanup_failed'; exit_code = 2
        try:
            left = command(['docker', 'ps', '-aq', '--filter', f'label={LABEL}={run_id}']).stdout.strip()
            require(not left, 'owned fixtures survived cleanup'); report['cleanup_label_scan_empty'] = True
        except Exception as e:
            report['status'] = 'cleanup_failed'; report['error'] = str(e); exit_code = 2
        report['source_hashes_after'] = hashes(); report['resources_after'] = resources()
        if report.get('source_hashes_before') != report['source_hashes_after']:
            report['status'] = 'failed'; report['error'] = 'source changed during execution'; exit_code = 1
        report['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat(); report['exit_code'] = exit_code
        log.close(); report['log_sha256'] = hashlib.sha256(log_path.read_bytes()).hexdigest()
        text = json.dumps(report, indent=2) + '\n'
        (output / f'payout-execution-postgres.{run_id}.json').write_text(text); (output / 'payout-execution-postgres.json').write_text(text)
        for s, handler in previous.items():
            signal.signal(s, handler)
        lock.close()
    print(json.dumps({'status': report['status'], 'exit_code': exit_code, 'tests': len(report.get('results', [])), 'error': report.get('error'), 'report': str(output / 'payout-execution-postgres.json')}), flush=True)
    return exit_code

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path('/home/hermes/audits/hobbysalon-commerce-fixes-20261002/payout'))
    parser.add_argument('--self-test', action='store_true', help='runner/parser unit tests only; no Docker or PostgreSQL launch')
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), indent=2))
    else:
        sys.exit(run(args.output_dir.resolve()))
