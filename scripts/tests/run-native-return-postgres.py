#!/usr/bin/env python3
"""Isolated native-return PostgreSQL acceptance; existing images only, no install/live calls.
Synthetic native-effect callbacks, NOT Medusa lifecycle acceptance. Exit 0: exact suite and
cleanup verified; 1: acceptance failure; 2: resource/startup/cleanup block. SIGKILL cannot trap.
"""
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
SOURCE = REPO / 'packages/modules/requests/src'
HELPER = REPO / 'scripts/tests/helpers/native-return-postgres.cjs'
BACKEND = 'sha256:7cb352c5130e6661e8ad470535845a1fa593b6d56619632343046d4d033464e1'
POSTGRES = 'sha256:97ff59a4e30e08d1c11bdcd9455e7832368c0572b576c9092cde2df4ae5552a3'
LABEL = 'local.audit.native-return.owner'
MIB = 1024 * 1024
FILES = ['utils/native-return-lifecycle.ts', 'utils/native-return-store.ts', 'modules/order-return-request/migrations/Migration20261002163000.ts']
EXPECTED = ['actual_migration_up', 'committed_started_independent_connection_before_effects', 'confirmed_restart_saved_identity_no_native_writes',
 'cross_process_same_order_one_winner', 'different_orders_progress_while_other_process_holds_lock', 'crash_after_begin_before_checkpoint_blocks_second_begin',
 *[p + '_restart_resumes_saved_identity' for p in ('begun', 'items_done')], *[p + '_unknown_blocks' for p in ('items_started', 'confirm_started')],
 *['immutable_' + f for f in ('request_id', 'order_id', 'fingerprint', 'plan', 'created_at', 'native_return_id', 'order_change_id')],
 'phase_rewind_refused', 'delete_refused', 'truncate_refused', 'unique_native_return_id', 'unique_order_change_id',
 'unique_unfinished_order_and_new_request_after_confirmed', 'native_and_verification_failures_sanitized', 'storage_checkpoint_failure_sanitized_no_effect',
 'real_knex_transaction_rejected', 'migration_down_refused_preserves_all_evidence']

class Blocked(RuntimeError):
    pass

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def hashes():
    return {str(p.relative_to(REPO)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [*[SOURCE / f for f in FILES], HELPER, Path(__file__).resolve()]}

def resources():
    mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    return {'memory_available': int(mem['MemAvailable'].split()[0]) * 1024, 'disk_available': shutil.disk_usage(REPO).free}

def tagged(text, tag):
    return [json.loads(line[len(tag) + 1:]) for line in text.splitlines() if line.startswith(tag + ' ')]

def validate(text, exit_code, before):
    require(exit_code == 0, f'Node exited {exit_code}')
    results, runtime, summaries = (tagged(text, t) for t in ('TEST_RESULT', 'RUNTIME_METADATA', 'NATIVE_RETURN_RESULT'))
    require([r.get('name') for r in results] == EXPECTED, 'incomplete/duplicate/reordered test inventory')
    require(all(r.get('status') == 'passed' for r in results), 'failed or skipped tests')
    require(len(runtime) == len(summaries) == 1, 'missing or duplicated runtime/summary')
    summary = summaries[0]
    require(summary == {'expected': 27, 'passed': 27, 'failed': 0, 'skipped': 0, 'results': results}, 'incorrect totals or summary')
    require(runtime[0]['source_hashes'] == {f: before[str((SOURCE / f).relative_to(REPO))] for f in FILES}, 'runtime source hash mismatch')
    require(runtime[0]['expected_tests'] == 27, 'runtime count mismatch')
    migrations, downs, crashes = (tagged(text, t) for t in ('MIGRATION_SQL', 'MIGRATION_DOWN_REFUSED', 'CRASH_OBSERVED'))
    require(len(migrations) == 1 and migrations[0]['direction'] == 'up' and len(migrations[0]['queries']) == 5, 'actual migration missing')
    require(len(downs) == 1 and downs[0]['emitted_queries'] == 0 and downs[0]['preserved_rows'] > 0, 'irreversible migration evidence missing')
    require(len(crashes) == 1 and crashes[0]['signal'] == 'SIGKILL' and crashes[0]['code'] is None, 'process death evidence missing')
    require(len(tagged(text, 'PROCESS_CONCURRENCY')) == 1, 'cross-process evidence missing')
    require(not tagged(text, 'FATAL_ERROR') and not tagged(text, 'CLEANUP_ERROR'), 'helper fatal/cleanup error')
    return summary

def run(output):
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / 'runner.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 2
    run_id = uuid.uuid4().hex
    log_path = output / f'native-return-postgres.{run_id}.log'
    report = {'run_id': run_id, 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'boundary': 'Real PostgreSQL/Knex/engine; synthetic native effects; NOT actual Medusa lifecycle', 'expected_tests': EXPECTED, 'status': 'running', 'cleanup': [], 'containers': {}, 'log': str(log_path)}
    owned = []
    log = log_path.open('w', buffering=1)
    def command(args, timeout=30, check=True):
        log.write('COMMAND ' + json.dumps(args) + '\n')
        try:
            done = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        except subprocess.TimeoutExpired as e:
            log.write((e.stdout or b'').decode(errors='replace') if isinstance(e.stdout, bytes) else (e.stdout or ''))
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
        name = f'native-return-{kind}-{run_id[:12]}'; owned.append(name)
        command(['docker', 'create', '--name', name, '--label', f'{LABEL}={run_id}', '--pull=never', *args, image, *tail])
        data = inspect(name)
        if data is None:
            raise Blocked('fixture vanished before isolation verification')
        host = data['HostConfig']
        require(host['ReadonlyRootfs'] and not host['Privileged'] and not host.get('PortBindings'), 'unsafe container')
        require(host['Memory'] in (128*MIB, 192*MIB) and host['MemorySwap'] == host['Memory'], 'unsafe memory')
        require(any(u['Name'] == 'core' and u['Soft'] == u['Hard'] == 0 for u in host['Ulimits']), 'core dump not disabled')
        require(host['NetworkMode'] == 'none' if kind == 'pg' else host['NetworkMode'] in ('container:' + report['containers']['pg']['id'], 'container:' + report['containers']['pg']['name']), 'unsafe network')
        binds = [m for m in data['Mounts'] if m['Type'] == 'bind']
        require(all(not m['RW'] for m in binds), 'writable mount')
        require({m['Source'] for m in binds} == (set() if kind == 'pg' else {str(SOURCE), str(HELPER)}), 'unexpected mounts')
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
        ast.parse(Path(__file__).read_text()); require(len(EXPECTED) == len(set(EXPECTED)) == 27, 'inventory error')
        before = hashes(); report['source_hashes_before'] = before; report['resources_before'] = resources()
        if report['resources_before']['memory_available'] < 500*MIB or report['resources_before']['disk_available'] < 500*MIB:
            raise Blocked('need >=500 MiB available RAM and disk; heavy path not started')
        for image in (BACKEND, POSTGRES):
            require(command(['docker', 'image', 'inspect', image, '--format', '{{.Id}}']).stdout.strip() == image, 'image pin mismatch')
        report['images'] = {'backend': BACKEND, 'postgres': POSTGRES}
        common = ['--read-only', '--ulimit', 'core=0:0', '--pids-limit', '64', '--security-opt', 'no-new-privileges']
        pg = create('pg', [*common, '--network', 'none', '--memory', '128m', '--memory-swap', '128m', '--shm-size', '8m',
            '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=128m', '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=4m', '--tmpfs', '/tmp:rw,noexec,nosuid,size=8m',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust'], POSTGRES, ['postgres', '-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=12', '-c', 'shared_buffers=8MB', '-c', 'work_mem=512kB', '-c', 'maintenance_work_mem=8MB', '-c', 'wal_buffers=1MB', '-c', 'min_wal_size=32MB', '-c', 'max_wal_size=32MB', '-c', 'fsync=on', '-c', 'synchronous_commit=on'])
        command(['docker', 'start', pg]); deadline = time.monotonic() + 45
        while command(['docker', 'exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], timeout=5, check=False).returncode:
            if time.monotonic() >= deadline:
                raise Blocked('PostgreSQL TCP readiness timeout')
            time.sleep(.4)
        command(['docker', 'exec', pg, 'createdb', '-h', '127.0.0.1', '-U', 'postgres', 'native_return_acceptance'])
        target = '/app/apps/backend/native-return-postgres.cjs'
        node = create('node', [*common, '--network', f'container:{pg}', '--memory', '192m', '--memory-swap', '192m', '--user', f'{os.getuid()}:{os.getgid()}', '--cap-drop', 'ALL', '--entrypoint', 'node',
            '--mount', f'type=bind,source={SOURCE},target=/app/apps/backend/audit-src,readonly', '--mount', f'type=bind,source={HELPER},target={target},readonly', '-e', 'NATIVE_RETURN_ISOLATED_FIXTURE=1', '-e', 'NODE_OPTIONS='], BACKEND, ['--max-old-space-size=64', target])
        done = command(['docker', 'start', '--attach', node], timeout=180, check=False)
        report['node_exit_code'] = done.returncode; report['results'] = tagged(done.stdout, 'TEST_RESULT'); report['runtime'] = tagged(done.stdout, 'RUNTIME_METADATA')
        report['summary'] = validate(done.stdout, done.returncode, before)
        for text, code in [('', 0), ('\n'.join(x for x in done.stdout.splitlines() if not x.startswith('TEST_RESULT ')), 0), (done.stdout.replace('"passed":27', '"passed":0'), 0), (done.stdout, 1)]:
            try:
                validate(text, code, before)
            except (RuntimeError, KeyError, ValueError, TypeError):
                continue
            raise RuntimeError('receipt consumer accepted invalid evidence')
        report['receipt_negative_controls'] = 'passed'; report['status'] = 'passed'; exit_code = 0
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
                    require(data['Config']['Labels'].get(LABEL) == run_id, 'not owned; refusing removal')
                    state = data['State']; report['cleanup'].append({'name': name, 'state': state})
                    if state.get('OOMKilled'):
                        report['status'] = 'blocked'; exit_code = 2
                    command(['docker', 'logs', name], check=False)
                    command(['docker', 'rm', '--force', name]); require(inspect(name) is None, 'fixture not removed')
                    report['cleanup'][-1]['removed_and_verified'] = True
                else:
                    report['cleanup'].append({'name': name, 'absent': True})
            except Exception as e:
                report['cleanup'].append({'name': name, 'error': str(e)}); report['status'] = 'cleanup_failed'; exit_code = 2
        report['source_hashes_after'] = hashes(); report['resources_after'] = resources()
        if report.get('source_hashes_before') != report['source_hashes_after']:
            report['status'] = 'failed'; report['error'] = 'source changed during execution'; exit_code = 1
        report['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat(); report['exit_code'] = exit_code
        log.close(); report['log_sha256'] = hashlib.sha256(log_path.read_bytes()).hexdigest()
        text = json.dumps(report, indent=2) + '\n'
        (output / f'native-return-postgres.{run_id}.json').write_text(text)
        (output / 'native-return-postgres.json').write_text(text)
        for s, handler in previous.items():
            signal.signal(s, handler)
        lock.close()
    print(json.dumps({'status': report['status'], 'exit_code': exit_code, 'tests': len(report.get('results', [])), 'error': report.get('error'), 'report': str(output / 'native-return-postgres.json')}), flush=True)
    return exit_code

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path('/home/hermes/audits/hobbysalon-commerce-fixes-20261002/native-return'))
    sys.exit(run(parser.parse_args().output_dir.resolve()))
