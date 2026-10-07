#!/usr/bin/env python3
"""Owned adaptation of candidate/scripts/tests/run-native-return-postgres.py.
No launch by default. --run explicitly opts into two uniquely owned isolated containers.
No installs, image pulls, external network, existing database or app boot. Exit 0 passes
only with complete real PG receipt and verified cleanup; 1 failed; 2 blocked/cleanup.
"""
import argparse
import ast
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent
CANDIDATE = ROOT.parent.parent / 'context'
INVENTORY = json.loads((ROOT / 'inventory.json').read_text())
EXPECTED = INVENTORY['cases']
PREVIOUS_BACKEND = 'sha256:ee7b54622292e0d130731cf1d90abe30ce02b9f0414b8b270b37224d1f168fab'
POSTGRES = 'sha256:87e04d274d186c7331d0e13c7c90c8b9f63b0d7ae94476c98a229a94d62c9745'
LABEL = 'local.audit.release-ack-pg.owner'
MIB = 1024 * 1024
LIMITS = {'pg': 256*MIB, 'node': 640*MIB}
BOUNDARY = 'Real candidate admission/kernel/financial consumer/replay + native migrations/PG; seeded parent financial state and explicit DB-backed graph/domain fixture adapters. NOT native checkout, all-recipient delivery, Redis/provider or host-power-loss.'

class Blocked(RuntimeError):
    pass

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def image_id(value):
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', value):
        raise argparse.ArgumentTypeError('backend image must be actual sha256 config ID (64 lowercase hex), not tag/manifest reference')
    return value

def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def hashes():
    result = {f: hashlib.sha256((CANDIDATE / f).read_bytes()).hexdigest() for f in INVENTORY['candidate_files']}
    result.update({'harness/' + f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in ('acceptance.cjs', 'inventory.json', 'run-postgres.py')})
    return result

def resources():
    mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    return {'memory_available': int(mem['MemAvailable'].split()[0])*1024, 'disk_available': shutil.disk_usage(ROOT).free,
            'swap_free': int(mem['SwapFree'].split()[0])*1024}

def tagged(text, tag):
    return [json.loads(line[len(tag)+1:]) for line in text.splitlines() if line.startswith(tag + ' ')]

def validate(text, exit_code, before):
    require(exit_code == 0, f'Node exited {exit_code}')
    results, runtime, summaries = (tagged(text, t) for t in ('TEST_RESULT', 'RUNTIME_METADATA', 'ACK_PG_RESULT'))
    require([r.get('name') for r in results] == EXPECTED, 'incomplete/duplicate/reordered test inventory')
    require(all(r.get('status') == 'passed' for r in results), 'failed or skipped tests')
    require(len(runtime) == len(summaries) == 1, 'missing or duplicated runtime/summary')
    require(summaries[0] == {'expected': len(EXPECTED), 'passed': len(EXPECTED), 'failed': 0, 'skipped': 0, 'results': results}, 'incorrect totals or summary')
    require(runtime[0]['source_hashes'] == {f: before[f] for f in INVENTORY['candidate_files']}, 'runtime source hash mismatch')
    require(runtime[0]['expected_tests'] == len(EXPECTED), 'runtime count mismatch')
    require(str(runtime[0]['node']).startswith('v24.'), 'expected pinned Node24 dependency image')
    require(runtime[0]['postgres'], 'runtime metadata missing')
    require(runtime[0]['versions'] == INVENTORY['expected_versions'], 'native version pins mismatch')
    identities = runtime[0]['dependency_identities']
    require(set(identities) == set(INVENTORY['expected_versions']), 'dependency identity inventory mismatch')
    for name, version in INVENTORY['expected_versions'].items():
        identity = identities[name]
        require(identity['version'] == version, 'dependency identity version mismatch')
        require(all(str(identity[k]).startswith('/') for k in ('package_json', 'entry')), 'absolute realpaths missing')
        require(all(re.fullmatch(r'[0-9a-f]{64}', identity[k]) for k in ('package_sha256', 'entry_sha256')), 'dependency byte hashes missing')
    edges = runtime[0]['identity_edges']
    require(len(edges) == 20 and len({(e['anchor'],e['package']) for e in edges}) == 20, 'realpath edge inventory missing')
    require(all(e['resolved'] == e['expected'] == identities[e['package']]['entry'] for e in edges), 'native/helper/entity realpath identity mismatch')
    require(runtime[0]['native_migrations'] == INVENTORY['native_migrations'], 'full native inventory mismatch')
    require(runtime[0]['native_migrations_sha256'] == canonical_hash(INVENTORY['native_migrations']) == INVENTORY['native_migrations_sha256'], 'native inventory hash mismatch')
    require(set(runtime[0]['loaded_candidate_sources']) <= set(INVENTORY['candidate_files']), 'unhashed transitive sources')
    require('packages/modules/b2c-core/src/workflows/cart/utils/complete-cart-fields.ts' in runtime[0]['loaded_candidate_sources'], 'transitive cart fields not loaded')
    helper_edges = runtime[0]['helper_identity_edges']
    require({(e['source'],e['package']) for e in helper_edges} == {(f,n) for f in runtime[0]['loaded_candidate_sources'] for n in INVENTORY['expected_versions']}, 'helper identity edge inventory mismatch')
    require(all(e['resolved'] == e['expected'] == identities[e['package']]['entry'] for e in helper_edges), 'helper native realpath identity mismatch')
    migrations = tagged(text, 'MIGRATION_SQL')
    candidate = [m for m in migrations if m.get('candidate')]
    require([m['name'] for m in candidate] == [Path(f).stem for f in INVENTORY['candidate_migrations']], 'candidate migration order mismatch')
    require(all(m['real_runner'] and m['direction'] == 'up' and isinstance(m['queries'], list) for m in migrations), 'real migration runner evidence missing')
    native = [m for m in migrations if not m.get('candidate')]
    require([(Path(m['file']).parts[-4], Path(m['file']).name, m['sha256']) for m in native] == [(x['module'], x['name'], x['sha256']) for x in INVENTORY['native_migrations']], 'full native applied inventory mismatch')
    require(all(m['sha256'] == before[f] and m['file'] == '/candidate/' + f for m,f in zip(candidate, INVENTORY['candidate_migrations'])), 'candidate migration bytes/path mismatch')
    orders = tagged(text, 'MIGRATION_ORDER')
    require(len(orders) == 1 and orders[0]['native'] == INVENTORY['native_migrations'] and orders[0]['native_sha256'] == INVENTORY['native_migrations_sha256'], 'applied native inventory hash mismatch')
    require(orders[0]['candidate'] == INVENTORY['candidate_migrations'] and orders[0]['candidate_sha256'] == {f:before[f] for f in INVENTORY['candidate_migrations']}, 'applied candidate inventory mismatch')
    require(len(tagged(text, 'NATIVE_LINK_SCHEMA')) == len(tagged(text, 'MIGRATION_ORDER')) == 1, 'native link/schema order evidence missing')
    crashes = tagged(text, 'CRASH_OBSERVED')
    require([r['phase'] for r in crashes] == ['admission-committed-business-uncommitted', 'consumer-claim-before-ack', 'ack-committed'], 'crash inventory missing')
    require(all(r['signal'] == 'SIGKILL' and r['code'] is None for r in crashes), 'process death evidence missing')
    for tag in ('PROCESS_CONCURRENCY', 'NATIVE_CONNECTION_IDENTITY', 'PHYSICAL_TRANSACTION', 'MIGRATION_DOWN_REFUSED'):
        require(len(tagged(text, tag)) == 1, tag + ' missing')
    require(not tagged(text, 'FATAL_ERROR') and not tagged(text, 'CLEANUP_ERROR'), 'helper fatal/cleanup error')
    return summaries[0]

def inspect_absent(name, returncode, output):
    if not returncode:
        return False
    normalized = output.lower()
    require('no such object: ' + name.lower() in normalized or 'no such container: ' + name.lower() in normalized, 'unexpected inspect failure; absence NOT established')
    return True

def self_test():
    ast.parse(Path(__file__).read_text())
    require(len(EXPECTED) == len(set(EXPECTED)), 'inventory error')
    require(canonical_hash(INVENTORY['native_migrations']) == INVENTORY['native_migrations_sha256'], 'native inventory hash error')
    require({f:hashes()[f] for f in INVENTORY['candidate_files']} == INVENTORY['candidate_sha256'], 'candidate pins mismatch')
    require(set(INVENTORY['candidate_migrations']) <= set(INVENTORY['candidate_files']), 'candidate migration hash coverage')
    image_id(PREVIOUS_BACKEND)
    image_id(POSTGRES)
    require(POSTGRES == 'sha256:87e04d274d186c7331d0e13c7c90c8b9f63b0d7ae94476c98a229a94d62c9745', 'PostgreSQL amd64 config pin mismatch')
    for invalid in ('latest', 'sha256:1234', 'repo@sha256:'+'a'*64, 'sha256:'+'A'*64):
        try:
            image_id(invalid)
        except argparse.ArgumentTypeError:
            continue
        raise RuntimeError('unsafe image reference accepted')
    require(inspect_absent('owned', 1, 'Error: No such object: owned'), 'not-found control')
    require(not inspect_absent('owned', 0, '[]'), 'positive inspect control')
    for message in ('permission denied', 'daemon unavailable', 'No such object: shared'):
        try:
            inspect_absent('owned', 1, message)
        except RuntimeError:
            continue
        raise RuntimeError('unsafe absence acceptance')
    for text, code in [('', 0), ('', 1)]:
        try:
            validate(text, code, hashes())
        except (RuntimeError, KeyError, ValueError, TypeError):
            continue
        raise RuntimeError('empty receipt accepted')
    print(json.dumps({'status': 'passed', 'scope': 'no-launch syntax/pinned source/full-native inventory/image-ID/absence and empty-receipt rejection only; NO PG evidence', 'cases': len(EXPECTED)}))
    return 0

def run(output, backend, dependency_role):
    require(output.is_relative_to(ROOT), 'evidence must stay inside owned database directory')
    output.mkdir(parents=True, exist_ok=True)
    lock = (output / 'runner.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        return 2
    run_id = uuid.uuid4().hex
    log_path = output / f'ack-postgres.{run_id}.log'
    report = {'run_id': run_id, 'started_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'boundary': BOUNDARY,
              'backend_dependency_role': dependency_role, 'candidate_root': str(CANDIDATE), 'expected_tests': EXPECTED, 'status': 'running', 'cleanup': [], 'containers': {}, 'log': str(log_path), 'diagnostic_stage': 'PG_SOURCE_PINS'}
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
        done = command(['docker', 'container', 'inspect', name], check=False)
        if inspect_absent(name, done.returncode, done.stdout):
            return None
        return json.loads(done.stdout)[0]
    def create(kind, args, image, tail):
        name = f'release-ack-{kind}-{run_id[:12]}'
        owned.append(name)
        command(['docker', 'create', '--name', name, '--label', f'{LABEL}={run_id}', '--pull=never', *args, image, *tail])
        data = inspect(name)
        require(data is not None, 'fixture vanished')
        require(data['Image'] == image, 'created container config image ID mismatch')
        host = data['HostConfig']
        require(host['ReadonlyRootfs'] and not host['Privileged'] and not host.get('PortBindings'), 'unsafe container')
        require(host['Memory'] == LIMITS[kind] and host['MemorySwap'] == host['Memory'], 'unsafe memory')
        require(any(u['Name'] == 'core' and u['Soft'] == u['Hard'] == 0 for u in host['Ulimits']), 'core dump not disabled')
        require(host['NetworkMode'] == 'none' if kind == 'pg' else host['NetworkMode'] in ('container:' + report['containers']['pg']['id'], 'container:' + report['containers']['pg']['name']), 'unsafe network')
        binds = [m for m in data['Mounts'] if m['Type'] == 'bind']
        require(all(not m['RW'] for m in binds), 'writable mount')
        expected_mounts = set() if kind == 'pg' else {str(CANDIDATE), str(ROOT)}
        require({m['Source'] for m in binds} == expected_mounts, 'unexpected mounts')
        require(all(m['Type'] in ('bind', 'tmpfs') for m in data['Mounts']), 'persistent volume present')
        if kind == 'node':
            require(data['Config']['User'] == f'{os.getuid()}:{os.getgid()}' and data['Config']['Entrypoint'] == ['node'], 'unsafe node identity')
        report['containers'][kind] = {'name': name, 'id': data['Id'], 'isolation_verified': True}
        return name
    def interrupted(signum, _frame):
        raise Blocked(f'interrupted by {signum}')
    previous = {s: signal.signal(s, interrupted) for s in (signal.SIGINT, signal.SIGTERM)}
    exit_code = 2
    try:
        ast.parse(Path(__file__).read_text())
        before = hashes()
        report['source_hashes_before'] = before
        require({f:before[f] for f in INVENTORY['candidate_files']} == INVENTORY['candidate_sha256'], 'candidate source pins mismatch')
        report['resources_before'] = resources()
        report['diagnostic_stage'] = 'PG_RESOURCE_GUARD'
        report['resource_policy'] = {'min_available_ram': 1152*MIB, 'min_available_disk': 512*MIB, 'container_limits': LIMITS, 'swap_allowed': False}
        if report['resources_before']['memory_available'] < 1152*MIB or report['resources_before']['disk_available'] < 512*MIB:
            raise Blocked('need >=1152 MiB available RAM and 512 MiB disk; heavy path NOT started; no capacity override')
        for image in (backend, POSTGRES):
            report['diagnostic_stage'] = 'PG_IMAGE_PINS'
            require(command(['docker', 'image', 'inspect', image, '--format', '{{.Id}}']).stdout.strip() == image, 'image pin mismatch')
        report['images'] = {'backend': backend, 'postgres': POSTGRES}
        report['diagnostic_stage'] = 'PG_FIXTURE_START'
        common = ['--read-only', '--ulimit', 'core=0:0', '--pids-limit', '96', '--security-opt', 'no-new-privileges', '--log-opt', 'max-size=4m', '--log-opt', 'max-file=1']
        pg = create('pg', [*common, '--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--shm-size', '16m',
            '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=192m', '--tmpfs', '/var/run/postgresql:rw,noexec,nosuid,size=4m', '--tmpfs', '/tmp:rw,noexec,nosuid,size=8m',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust'], POSTGRES,
            ['postgres', '-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=24', '-c', 'shared_buffers=8MB', '-c', 'work_mem=512kB', '-c', 'maintenance_work_mem=8MB', '-c', 'wal_buffers=1MB', '-c', 'min_wal_size=32MB', '-c', 'max_wal_size=32MB', '-c', 'fsync=on', '-c', 'synchronous_commit=on'])
        command(['docker', 'start', pg])
        deadline = time.monotonic()+45
        while command(['docker', 'exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], timeout=5, check=False).returncode:
            if time.monotonic() >= deadline:
                raise Blocked('PostgreSQL TCP readiness timeout')
            time.sleep(.4)
        command(['docker', 'exec', pg, 'createdb', '-h', '127.0.0.1', '-U', 'postgres', 'webhook_ack_acceptance'])
        report['diagnostic_stage'] = 'PG_NODE_START'
        node = create('node', [*common, '--network', f'container:{pg}', '--memory', '640m', '--memory-swap', '640m', '--cpus', '1.5',
            '--user', f'{os.getuid()}:{os.getgid()}', '--cap-drop', 'ALL', '--entrypoint', 'node', '--workdir', '/app/apps/backend',
            '--mount', f'type=bind,source={CANDIDATE},target=/candidate,readonly', '--mount', f'type=bind,source={ROOT},target=/fixture,readonly',
            '-e', 'ACK_ISOLATED_FIXTURE=1', '-e', 'NODE_OPTIONS=', '-e', 'MEDUSA_TELEMETRY_DISABLED=true'], backend,
            ['--max-old-space-size=160', '/fixture/acceptance.cjs'])
        done = command(['docker', 'start', '--attach', node], timeout=360, check=False)
        report['node_exit_code'] = done.returncode
        report['results'] = tagged(done.stdout, 'TEST_RESULT')
        report['runtime'] = tagged(done.stdout, 'RUNTIME_METADATA')
        report['diagnostic_stage'] = 'PG_RECEIPT_VERIFY'
        report['summary'] = validate(done.stdout, done.returncode, before)
        # Real-positive receipt negative controls. These do not synthesize PG evidence.
        for text, code in [('', 0), ('\n'.join(x for x in done.stdout.splitlines() if not x.startswith('TEST_RESULT ')), 0),
                           ('\n'.join(x for x in done.stdout.splitlines() if not x.startswith('CRASH_OBSERVED ')), 0), (done.stdout, 1)]:
            try:
                validate(text, code, before)
            except (RuntimeError, KeyError, ValueError, TypeError):
                continue
            raise RuntimeError('receipt consumer accepted invalid evidence')
        report['receipt_negative_controls'] = 'passed'
        report['diagnostic_stage'] = 'COMPLETE'
        report['status'] = 'passed'
        exit_code = 0
    except Blocked as e:
        report['status'] = 'blocked'
        report['error'] = str(e)
    except Exception as e:
        report['status'] = 'failed'
        report['error'] = f'{type(e).__name__}: {e}'
        exit_code = 1
    finally:
        for s in previous:
            signal.signal(s, signal.SIG_IGN)
        for name in reversed(owned):
            try:
                data = inspect(name)
                if data:
                    require(data['Config']['Labels'].get(LABEL) == run_id, 'not owned; refusing removal')
                    state = data['State']
                    report['cleanup'].append({'name': name, 'state': state})
                    if state.get('OOMKilled'):
                        report['status'] = 'blocked'
                        report['diagnostic_stage'] = 'PG_CLEANUP'
                        exit_code = 2
                    command(['docker', 'logs', name], check=False)
                    command(['docker', 'rm', '--force', name])
                    require(inspect(name) is None, 'fixture not removed')
                    report['cleanup'][-1]['removed_and_verified'] = True
                else:
                    report['cleanup'].append({'name': name, 'absent': True})
            except Exception as e:
                report['cleanup'].append({'name': name, 'error': str(e)})
                report['status'] = 'cleanup_failed'
                report['diagnostic_stage'] = 'PG_CLEANUP'
                exit_code = 2
        report['source_hashes_after'] = hashes()
        report['resources_after'] = resources()
        if report.get('source_hashes_before') != report['source_hashes_after']:
            report['status'] = 'failed'
            report['error'] = 'source changed during execution'
            report['diagnostic_stage'] = 'PG_SOURCE_PINS'
            exit_code = 1
        report['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        report['exit_code'] = exit_code
        log.close()
        report['log_sha256'] = hashlib.sha256(log_path.read_bytes()).hexdigest()
        text = json.dumps(report, indent=2)+'\n'
        (output / f'ack-postgres.{run_id}.json').write_text(text)
        (output / 'ack-postgres.json').write_text(text)
        for s, handler in previous.items():
            signal.signal(s, handler)
        lock.close()
    print(json.dumps({'status': report['status'], 'exit_code': exit_code, 'tests': len(report.get('results', [])), 'diagnostic_stage': report['diagnostic_stage']}), flush=True)
    return exit_code

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--run', action='store_true')
    mode.add_argument('--self-test', action='store_true')
    parser.add_argument('--backend-image', type=image_id, help='actual locally available new image config ID; never pulls')
    parser.add_argument('--candidate-root', type=Path, default=CANDIDATE, help='build-extracted candidate source root')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'evidence')
    args = parser.parse_args()
    CANDIDATE = args.candidate_root.resolve()
    backend = args.backend_image or PREVIOUS_BACKEND
    dependency_role = 'candidate-image-deps' if args.backend_image and backend != PREVIOUS_BACKEND else 'previous-deps'
    if args.run:
        sys.exit(run(args.output_dir.resolve(), backend, dependency_role))
    if args.self_test:
        sys.exit(self_test())
    print(json.dumps({'status': 'NOT_RUN', 'backend_image': backend, 'backend_dependency_role': dependency_role, 'candidate_root': str(CANDIDATE), 'boundary': BOUNDARY, 'command': f'python3 {__file__} --run', 'resources': resources(), 'expected_tests': len(EXPECTED)}))
