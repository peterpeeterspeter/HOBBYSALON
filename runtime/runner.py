#!/usr/bin/env python3
"""Hosted-only, synthetic, exact-image runtime gate. Importing never invokes Docker."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import tarfile
import threading
import time

MIB = 1024**2
HOST = 'unix:///tmp/hs-runtime/docker.sock'
ROOT = Path('/mnt/hs-runtime')
IMAGE = 'sha256:b593554ed71091d152a73b15995818e7460e69ea41f98c16b022af52a6e521ca'
SOURCE = 'b538938f0fb21f06a44fea9272e3822eddd795c7ca372c4c8c42f0d4abc7a368'
GZIP_SHA = '9f3439e95cf28f8c1e456dfa6ec27dfa63d28afe7d80b46cf156d861ea5f6c36'
GZIP_BYTES = 273965027
LABEL_KEY = 'hs.runtime.trial'
MEMORY = {'pg': 512, 'redis': 128, 'migrate': 1536, 'app': 1536}
CATALOG = """SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),'history_tables',(SELECT jsonb_agg(table_name ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%migration%'))"""


class Refused(RuntimeError):
    pass


def require(condition, reason):
    if not condition:
        raise Refused(reason)


def hosted_guard(env):
    require(env.get('GITHUB_ACTIONS') == 'true' and
            env.get('RUNNER_ENVIRONMENT') == 'github-hosted' and
            env.get('GITHUB_RUN_ATTEMPT') == '1' and env.get('DOCKER_HOST') == HOST,
            'hosted-only-guard')
    require(env.get('DOCKER_CONFIG') == '/tmp/hs-runtime/client', 'dedicated-client-required')
    require(not env.get('GH_TOKEN'), 'acquisition-token-forbidden')


def read_json(path):
    require(not path.is_symlink() and path.is_file() and path.stat().st_size <= MIB, 'json-input-bound')
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            require(key not in obj, 'duplicate-json-key')
            obj[key] = value
        return obj
    return json.loads(path.read_bytes(), object_pairs_hook=unique)


def validate_manifest(value):
    require(isinstance(value, dict), 'invalid-manifest')
    require(value.get('image') == IMAGE and value.get('image_id') == IMAGE and
            value.get('source_hash') == SOURCE and value.get('gzip_sha256') == GZIP_SHA and
            value.get('gzip_bytes') == GZIP_BYTES, 'invalid-manifest-identity')
    require(all(value.get(k) is True for k in ('config_sha256_verified',
            'ordered_layer_sha256_verified', 'source_receipt_verified')), 'unverified-manifest')
    layers = value.get('diff_ids')
    require(isinstance(layers, list) and len(layers) == 11 and all(isinstance(x, str) and
            re.fullmatch(r'sha256:[0-9a-f]{64}', x) for x in layers), 'invalid-manifest-layers')
    return value


class Evidence:
    def __init__(self, root):
        self.root = root
        require(root.is_dir() and not root.is_symlink(), 'evidence-directory')
        self.receipts = []

    def write(self, name, data, cap=128*MIB):
        if isinstance(data, str):
            data = data.encode()
        require(Path(name).name == name and len(data) <= cap, 'evidence-file-bound')
        size = sum(p.stat().st_size for p in self.root.iterdir() if p.is_file())
        # Reserve space for final receipts, even after an output-bound failure.
        require(size + len(data) <= 256*MIB - (0 if name.startswith('runtime-') else MIB),
                'evidence-total-bound')
        path = self.root / name
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        digest = hashlib.sha256(data).hexdigest()
        require(hashlib.sha256(path.read_bytes()).hexdigest() == digest, 'evidence-readback')
        self.receipts.append({'file': name, 'bytes': len(data), 'sha256': digest})
        return path

    def json(self, name, data):
        return self.write(name, json.dumps(data, sort_keys=True, indent=2)+'\n', MIB)


def private_write(path, data):
    require(len(data) <= MIB, 'private-file-bound')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    require(path.read_bytes() == data, 'private-readback')


class Commands:
    """Drain both pipes throughout TERM/KILL watchdog shutdown; persist even on failure."""
    def __init__(self, evidence, interrupted, deadline=None):
        self.evidence, self.interrupted, self.deadline = evidence, interrupted, deadline
        self.sequence = 0
        self.cleanup = False
        # Never inherit credentials, proxies, arbitrary PATH or Docker configuration.
        self.env = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                    'HOME': '/tmp/hs-runtime/client', 'LANG': 'C.UTF-8',
                    'DOCKER_HOST': HOST, 'DOCKER_CONFIG': '/tmp/hs-runtime/client'}

    def run(self, argv, timeout=30, cap=2*MIB, input_data=None, input_stream=None, check=True, stdout_name=None, stderr_name=None):
        used = sum(p.stat().st_size for p in self.evidence.root.iterdir() if p.is_file())
        available = 256*MIB - used - 2*MIB
        require(available > 0, 'evidence-space-before-command')
        cap = min(cap, available)
        self.sequence += 1
        prefix = 'cmd-%04d' % self.sequence
        out, err = bytearray(), bytearray()
        overflow, feed_error = threading.Event(), threading.Event()
        lock = threading.Lock()
        reason = None
        p = None
        threads = []
        started = time.monotonic()
        try:
            p = subprocess.Popen(argv, stdin=subprocess.PIPE if input_data is not None or input_stream else subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=self.env,
                                 start_new_session=True)
            def drain(pipe, target):
                try:
                    while True:
                        b = os.read(pipe.fileno(), 65536)
                        if not b:
                            break
                        with lock:
                            available = cap - len(out) - len(err)
                            target.extend(b[:max(0, available)])
                            if len(b) > available:
                                overflow.set()
                finally:
                    pipe.close()
            for pipe, target in ((p.stdout, out), (p.stderr, err)):
                t = threading.Thread(target=drain, args=(pipe, target), daemon=True)
                t.start()
                threads.append(t)
            if p.stdin:
                def feed():
                    try:
                        if input_stream:
                            for b in iter(lambda: input_stream.read(MIB), b''):
                                p.stdin.write(b)
                        else:
                            p.stdin.write(input_data)
                    except (BrokenPipeError, OSError):
                        feed_error.set()
                    finally:
                        try:
                            p.stdin.close()
                        except OSError:
                            pass
                t = threading.Thread(target=feed, daemon=True)
                t.start()
                threads.append(t)
            term_at = None
            while p.poll() is None or any(t.is_alive() for t in threads):
                now = time.monotonic()
                if not reason:
                    if overflow.is_set():
                        reason = 'command-output-bound'
                    elif now-started > timeout:
                        reason = 'command-timeout'
                    elif not self.cleanup and self.interrupted.is_set():
                        reason = 'runner-sigterm'
                    elif not self.cleanup and self.deadline and now > self.deadline:
                        reason = 'runner-time-budget'
                if reason and term_at is None:
                    try:
                        os.killpg(p.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    term_at = now
                if term_at is not None and now-term_at > .75:
                    try:
                        os.killpg(p.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    if now-term_at > 2:
                        break
                time.sleep(.02)
            p.wait(timeout=2)
            for t in threads:
                t.join(timeout=1)
            reason = reason or ('command-output-bound' if overflow.is_set() else None)
            reason = reason or ('command-input-failed' if feed_error.is_set() else None)
        except Exception as exc:
            reason = reason or ('command-exception-'+type(exc).__name__)
            if p:
                try:
                    os.killpg(p.pid, signal.SIGTERM)
                    p.wait(timeout=.75)
                except (ProcessLookupError, subprocess.TimeoutExpired):
                    try:
                        os.killpg(p.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    p.wait(timeout=2)
                for t in threads:
                    t.join(timeout=1)
        finally:
            # The command arguments are deliberately omitted: no synthetic env values leak.
            self.evidence.write(stdout_name or prefix+'.stdout', bytes(out), cap)
            self.evidence.write(stderr_name or prefix+'.stderr', bytes(err), cap)
            self.evidence.json(prefix+'.json', {'returncode': p.returncode if p else None,
                'reason': reason, 'seconds': time.monotonic()-started, 'stdout_bytes': len(out),
                'stderr_bytes': len(err), 'complete': reason is None})
        if reason:
            raise Refused(reason)
        if check and p.returncode:
            raise Refused('command-nonzero-exit')
        return p.returncode, bytes(out), bytes(err)

    def docker(self, *args, **kw):
        return self.run(['docker', '--host='+HOST, *args], **kw)

    def ok(self, *args, **kw):
        return self.docker(*args, **kw)[1]


def subset(before, after):
    return all(all(row in (after.get(key) or []) for row in (before.get(key) or []))
               for key in ('columns', 'triggers', 'history_tables'))


def migration_receipt(data):
    rows = []
    for line in data.decode('utf-8', 'replace').splitlines():
        try:
            row = json.loads(line.strip())
        except ValueError:
            continue
        if isinstance(row, dict) and row.get('status') == 'verified':
            rows.append(row)
    require(len(rows) == 1 and rows[0].get('schema') == 'public' and
            rows[0].get('policies') == {'links': 'safe', 'scripts': 'skip'}, 'migration-receipt')
    return rows[0]


class Trial:
    def __init__(self, evidence, private, manifest, pins, archive, interrupted):
        self.e = evidence
        self.private, self.manifest, self.pins, self.archive = private, manifest, pins, archive
        self.interrupted = interrupted
        self.cmd = Commands(evidence, interrupted, time.monotonic()+780)
        self.label = 'hs-runtime-'+secrets.token_hex(12)
        self.owned, self.binds, self.facts = {}, {}, {}
        self.work = ROOT/'work'
        self.preserved = set()
        self.policy_failures = []

    def inspect(self, role, security=True):
        cid = self.owned[role]
        # Projection happens inside Docker BEFORE the command recorder sees bytes.
        projection = '{"Id":{{json .Id}},"Image":{{json .Image}},"Name":{{json .Name}},"Config":{"Labels":{{json .Config.Labels}}},"HostConfig":{{json .HostConfig}},"State":{{json .State}},"Mounts":{{json .Mounts}}}'
        v = json.loads(self.cmd.ok('inspect', '--format', projection, cid))
        require(v['Id'] == cid and v['Config'].get('Labels', {}).get(LABEL_KEY) == self.label and
                v['Config'].get('Labels', {}).get('hs.runtime.role') == role and
                v.get('Name') == '/'+self.label+'-'+role, 'container-ownership')
        if security:
            h = v['HostConfig']
            require(h['Memory'] == MEMORY[role]*MIB and h['MemorySwap'] == MEMORY[role]*MIB and
                    h['ReadonlyRootfs'] and not h.get('Privileged') and not h.get('PortBindings') and
                    set(h.get('CapDrop', [])) == {'ALL'} and
                    any(x.startswith('no-new-privileges') for x in h.get('SecurityOpt', [])) and
                    not h.get('Tmpfs') and h.get('RestartPolicy', {}).get('Name') == 'no', 'container-security')
            require(h['NetworkMode'] == ('none' if role == 'pg' else 'container:'+self.owned['pg']), 'network-isolation')
            log_config = h.get('LogConfig', {})
            require(log_config.get('Type') == 'json-file' and
                    log_config.get('Config', {}).get('max-size', '-1') in ('-1', '') and
                    not log_config.get('Config', {}).get('max-file'), 'log-rotation-forbidden')
            require(not v['State'].get('OOMKilled'), 'container-oom')
            actual = {(m['Source'], m['Destination'], m['RW']) for m in v['Mounts'] if m['Type'] == 'bind'}
            expected = {(str(src), dst, rw) for src, dst, rw in self.binds[role]}
            require(actual == expected and len(v['Mounts']) == len(expected), 'unexpected-container-mount')
            require(v['Image'] == (IMAGE if role in ('app', 'migrate') else self.facts[role+'_image_id']), 'container-image')
        return v

    def fresh_dirs(self, role):
        base = self.work/role
        base.mkdir(mode=0o700)
        paths = []
        destinations = {'pg': ('/var/lib/postgresql/data', '/var/run/postgresql', '/tmp'),
                        'redis': ('/data', '/tmp'),
                        'migrate': ('/tmp', '/app/apps/backend/static'),
                        'app': ('/tmp', '/app/apps/backend/static')}[role]
        for index, dst in enumerate(destinations):
            path = base/str(index)
            path.mkdir(mode=0o700)
            paths.append((path, dst, True))
        if role in ('migrate', 'app'):
            paths.append((self.work/'deny.cjs', '/gate-deny.cjs', False))
        self.binds[role] = paths

    def create(self, role, image, command, user):
        self.fresh_dirs(role)
        args = ['create', '--pull=never', '--name', self.label+'-'+role,
                '--label', LABEL_KEY+'='+self.label, '--label', 'hs.runtime.role='+role,
                '--network', 'none' if role == 'pg' else 'container:'+self.owned['pg'],
                '--restart=no', '--read-only', '--cap-drop=ALL', '--security-opt', 'no-new-privileges',
                '--user', user, '--memory', str(MEMORY[role])+'m', '--memory-swap', str(MEMORY[role])+'m',
                '--cpus', '1', '--pids-limit', '256', '--stop-timeout', '10',
                '--log-driver', 'json-file', '--env-file', str(self.private/(role+'.env'))]
        # No rotation: full startup logs survive until final collection. Hard filesystem bounds disk.
        for src, dst, rw in self.binds[role]:
            args += ['--mount', 'type=bind,src='+str(src)+',dst='+dst+('' if rw else ',readonly')]
        try:
            cid = self.cmd.ok(*args, image, *command, timeout=30).decode().strip()
            require(re.fullmatch('[0-9a-f]{64}', cid), 'new-container-id')
            self.owned[role] = cid
        except Exception:
            # A daemon may have created a container even when its client timed out.
            old = self.cmd.cleanup
            self.cmd.cleanup = True
            try:
                ids = self.cmd.ok('ps', '-aq', '--no-trunc', '--filter', 'label='+LABEL_KEY+'='+self.label,
                                  '--filter', 'name=^/'+self.label+'-'+role+'$').decode().split()
                for cid in ids:
                    self.owned[role] = cid
                    self.inspect(role, security=False)
            finally:
                self.cmd.cleanup = old
            raise
        self.inspect(role)
        if role in ('pg', 'redis'):
            raw = self.cmd.ok('cp', cid+':/etc/passwd', '-', cap=MIB)
            with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
                entries = [m for m in tar.getmembers() if m.isfile() and Path(m.name).name == 'passwd']
                require(len(entries) == 1 and entries[0].size <= 65536, 'image-passwd')
                rows = tar.extractfile(entries[0]).read().decode().splitlines()
            account = 'postgres' if role == 'pg' else 'redis'
            matches = [x.split(':') for x in rows if x.startswith(account+':')]
            require(len(matches) == 1 and matches[0][2].isdigit() and matches[0][3].isdigit(), 'image-uid')
            uid = matches[0][2]+':'+matches[0][3]
        else:
            uid = '1001:1001'
        for src, _, rw in self.binds[role]:
            if rw:
                require(src.parent == self.work/role and not src.is_symlink(), 'precise-owned-path')
                self.cmd.run(['sudo', '-n', 'chown', uid, '--', str(src)])
        return cid

    def sql(self, query, name):
        script = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='15s';\n"+query+";\nROLLBACK;\n"
        out = self.cmd.ok('exec', '-i', self.owned['pg'], 'psql', '-X', '-qAt', '-U', 'gate',
                          '-d', 'runtime_gate', '-v', 'ON_ERROR_STOP=1', input_data=script.encode())
        self.e.write(name, out)
        return json.loads(out)

    def ready(self, role, command, seconds):
        end = time.monotonic()+seconds
        while time.monotonic() < end:
            require(self.inspect(role)['State']['Running'], role+'-exited')
            code, _, _ = self.cmd.docker('exec', self.owned[role], *command, timeout=5, check=False)
            if code == 0:
                return
            require(not self.interrupted.wait(.5), 'runner-sigterm')
        raise Refused(role+'-health-timeout')

    def health(self):
        code = "const h=require('http');h.get('http://127.0.0.1:9000/health',r=>{r.resume();r.on('end',()=>{console.log(JSON.stringify({status:r.statusCode}));process.exit(r.statusCode===200?0:1)})}).on('error',()=>process.exit(2));setTimeout(()=>process.exit(3),3000).unref();"
        self.ready('app', ['node', '-e', code], 120)

    def namespace(self, role, checkpoint=None):
        out = self.cmd.ok('exec', self.owned[role], 'sh', '-c',
            "cat /proc/net/dev; printf '\\nGATE_ROUTE\\n'; cat /proc/net/route; printf '\\nGATE_IPV6\\n'; cat /proc/net/ipv6_route")
        dev, remaining = out.decode().split('\nGATE_ROUTE\n', 1)
        route, v6 = remaining.split('\nGATE_IPV6\n', 1)
        value = {'dev': dev, 'route': route, 'v6': v6}
        require([x.split(':')[0].strip() for x in value['dev'].splitlines() if ':' in x] == ['lo'], 'non-loopback-interface')
        require(len(value['route'].strip().splitlines()) == 1 and
                all(not x.strip() or x.split()[-1] == 'lo' for x in value['v6'].splitlines()), 'external-route')
        self.e.json('namespace-'+(checkpoint or role)+'.json', value)

    def trace(self, role, name, enforce=True):
        path = self.binds[role][0][0]/'gate-egress.jsonl'
        # File belongs to container UID. Read via sudo without mounting outside the hard filesystem.
        _, out, _ = self.cmd.run(['sudo', '-n', 'python3', '-c',
            "import os,sys,stat; p=sys.argv[1]; f=os.open(p,os.O_RDONLY|os.O_NOFOLLOW); s=os.fstat(f); assert stat.S_ISREG(s.st_mode) and s.st_size<=2097152; b=os.read(f,2097153); assert len(b)<=2097152; sys.stdout.buffer.write(b)", str(path)], cap=2*MIB)
        self.e.write(name, out, 2*MIB)
        rows = [json.loads(x) for x in out.decode().splitlines() if x.strip()]
        require(any(x.get('event') == 'active' for x in rows), 'observer-not-active')
        if any(x.get('event') == 'denied' for x in rows):
            self.policy_failures.append(role+'-outbound-attempt')
            if enforce:
                raise Refused('outbound-attempt')
        return True

    def logs(self, role, name, enforce=True):
        _, out, err = self.cmd.docker('logs', self.owned[role], timeout=20, cap=16*MIB,
                                    stdout_name=name+'.stdout', stderr_name=name+'.stderr')
        if b'GATE_EGRESS_DENIED' in out+err:
            self.policy_failures.append(role+'-outbound-log-denial')
            if enforce:
                raise Refused('outbound-log-denial')
        return out+err

    def dump(self, name):
        out = self.cmd.ok('exec', self.owned['pg'], 'pg_dump', '-U', 'gate', '-d', 'runtime_gate',
                          '--format=custom', '--no-owner', '--no-acl', timeout=35, cap=64*MIB,
                          stdout_name=name)
        require(out.startswith(b'PGDMP'), 'invalid-custom-dump')

    def synthetic_env(self):
        password = secrets.token_hex(24)
        pg = 'POSTGRES_USER=gate\nPOSTGRES_DB=runtime_gate\nPOSTGRES_PASSWORD='+password+'\nPGDATA=/var/lib/postgresql/data/pgdata\n'
        private_write(self.private/'pg.env', pg.encode())
        private_write(self.private/'redis.env', b'GATE_DUMMY_ONLY=true\n')
        env = {'NODE_ENV':'production', 'APP_ENV':'production', 'DATABASE_URL':'postgresql://gate:'+password+'@127.0.0.1:5432/runtime_gate?sslmode=disable',
               'DATABASE_SSL':'false', 'DATABASE_SCHEMA':'public', 'REDIS_URL':'redis://127.0.0.1:6379',
               'WORKER_MODE':'server', 'PORT':'9000', 'JWT_SECRET':secrets.token_hex(32), 'COOKIE_SECRET':secrets.token_hex(32),
               'COMMERCE_PAYMENTS_ENABLED':'false', 'COMMERCE_PAYOUTS_ENABLED':'false', 'DISABLE_ALGOLIA':'true', 'ENABLE_ALGOLIA':'false',
               'MEDUSA_TELEMETRY_DISABLED':'true', 'STRIPE_SECRET_API_KEY':'sk_test_runtime_gate_invalid_dummy',
               'STRIPE_WEBHOOK_SECRET':'whsec_runtime_gate_dummy', 'RESEND_API_KEY':'re_runtime_gate_invalid_dummy',
               'RESEND_FROM_EMAIL':'Runtime Gate <gate@example.invalid>', 'BACKEND_URL':'http://127.0.0.1:9000',
               'NODE_OPTIONS':'--max-old-space-size=1152 --require=/gate-deny.cjs', 'RELEASE_MIGRATION_APPROVED':'yes',
               'RELEASE_MIGRATION_SOURCE_SHA256':SOURCE, 'RELEASE_MIGRATE_LINKS':'safe', 'RELEASE_MIGRATE_SCRIPTS':'skip'}
        for key in ('STORE_CORS', 'ADMIN_CORS', 'VENDOR_CORS', 'AUTH_CORS'):
            env[key] = 'http://127.0.0.1:9000'
        data = ''.join(k+'='+v+'\n' for k, v in env.items()).encode()
        for role in ('migrate', 'app'):
            private_write(self.private/(role+'.env'), data)

    def execute(self):
        info = json.loads(self.cmd.ok('info', '--format', '{{json .}}'))
        require(info.get('DockerRootDir') == str(ROOT/'docker') and info.get('CgroupVersion') == '2', 'dedicated-daemon-root')
        for args in (('ps', '-aq'), ('image', 'ls', '-aq'), ('volume', 'ls', '-q')):
            require(not self.cmd.ok(*args).strip(), 'preexisting-daemon-resources')
        networks = [json.loads(row) for row in self.cmd.ok('network', 'ls', '--format', '{{json .Name}}').decode().splitlines()]
        require(set(networks) <= {'none', 'host', 'bridge'}, 'preexisting-daemon-networks')
        require(os.path.ismount(ROOT) and ROOT.stat().st_dev != ROOT.parent.stat().st_dev, 'hard-filesystem-required')
        st = os.statvfs(ROOT)
        require(st.f_blocks*st.f_frsize <= 6*1024**3, 'hard-filesystem-size')
        require(not self.work.exists() and not self.work.is_symlink(), 'fresh-work-required')
        self.work.mkdir(mode=0o700)
        observer = Path(__file__).with_name('deny.cjs').read_bytes()
        private_write(self.work/'deny.cjs', observer)
        os.chmod(self.work/'deny.cjs', 0o444)
        self.synthetic_env()
        require(not self.archive.is_symlink() and self.archive.stat().st_size == GZIP_BYTES, 'archive-size')
        with self.archive.open('rb') as f:
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
            require(digest == GZIP_SHA, 'archive-hash')
            f.seek(0)
            self.cmd.docker('load', '--quiet', input_stream=f, timeout=180)
        image = json.loads(self.cmd.ok('image', 'inspect', IMAGE))[0]
        require(image['Id'] == self.manifest['image_id'] and image['RootFS']['Layers'] == self.manifest['diff_ids'], 'loaded-image-config-diffids')
        self.facts['exact_image'] = IMAGE
        self.e.json('imported-image.json', {'image': image['Id'], 'diff_ids': image['RootFS']['Layers']})
        for role, key in (('pg', 'postgres'), ('redis', 'redis')):
            pin = self.pins[key]
            require(re.fullmatch(key+r'@sha256:[0-9a-f]{64}', pin), 'immutable-dependency-pin')
            self.cmd.ok('pull', pin, timeout=90)
            dep = json.loads(self.cmd.ok('image', 'inspect', pin))[0]
            require(pin in dep.get('RepoDigests', []), 'dependency-digest')
            self.facts[role+'_image_id'] = dep['Id']
        pg = self.create('pg', self.pins['postgres'], ['postgres', '-c', 'shared_buffers=64MB', '-c', 'listen_addresses=127.0.0.1'], 'postgres')
        self.cmd.ok('start', pg)
        self.ready('pg', ['pg_isready', '-h', '127.0.0.1', '-U', 'gate', '-d', 'runtime_gate'], 45)
        empty = self.sql("SELECT jsonb_build_object('public_tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))", 'empty-public.json')
        require(empty['public_tables'] == 0, 'nonempty-postgres')
        self.facts['fresh_public_empty'] = True
        redis = self.create('redis', self.pins['redis'], ['redis-server', '--bind', '127.0.0.1', '--appendonly', 'yes', '--appendfsync', 'always', '--save', '', '--maxmemory', '64mb', '--maxmemory-policy', 'noeviction'], 'redis')
        self.cmd.ok('start', redis)
        self.ready('redis', ['redis-cli', 'ping'], 20)
        require(self.cmd.ok('exec', redis, 'redis-cli', 'DBSIZE').strip() == b'0', 'nonempty-redis')
        self.facts['fresh_redis_empty'] = True
        self.namespace('pg', 'before-migration')
        migrate = self.create('migrate', IMAGE, ['migrate'], '1001:1001')
        self.cmd.ok('start', migrate)
        end = time.monotonic()+360
        while self.inspect('migrate')['State']['Running']:
            require(time.monotonic() < end and not self.interrupted.wait(.5), 'migration-timeout-or-signal')
        state = self.inspect('migrate')['State']
        log = self.logs('migrate', 'migration-log')
        self.trace('migrate', 'migration-egress.jsonl')
        require(state['ExitCode'] == 0, 'native-migration-exit')
        receipt = migration_receipt(log)
        self.e.json('migration-verified.json', receipt)
        self.facts['migration'] = 'verified'
        catalog = self.sql(CATALOG, 'catalog-before-boot.json')
        require(any(c['table'] == 'marketplace_capture_consumer_ack' for c in catalog.get('columns') or []), 'ack-table-missing')
        self.facts['ack_table_present'] = True
        self.namespace('pg', 'before-app')
        app = self.create('app', IMAGE, ['start'], '1001:1001')
        self.cmd.ok('start', app)
        self.namespace('app')
        self.health()
        self.facts['health_boot'] = 200
        require(subset(catalog, self.sql(CATALOG, 'catalog-after-boot.json')), 'boot-catalog-subset')
        self.dump('before-restart.pgdump')
        self.inspect('app', security=False)
        self.cmd.ok('stop', '--time', '10', app, timeout=20)
        v = self.inspect('app')
        require(not v['State']['Running'] and v['State']['ExitCode'] in (0, 143), 'app-stop-not-graceful')
        self.facts['graceful_stop_exit'] = v['State']['ExitCode']
        self.cmd.ok('start', app)
        self.health()
        self.facts['health_restart'] = 200
        require(subset(catalog, self.sql(CATALOG, 'catalog-after-restart.json')), 'restart-catalog-subset')
        self.facts['catalog_subset_boot_restart'] = True

    def finish(self):
        """Preservation then cleanup; independently attempt every owned resource on errors."""
        self.cmd.cleanup = True
        errors = []
        # Stop writers first. Never remove PG until snapshot and all logs are durable.
        for role in ('app', 'migrate', 'redis'):
            if role not in self.owned:
                continue
            try:
                v = self.inspect(role, security=False)
                if v['State']['Running']:
                    self.cmd.ok('stop', '--time', '5', self.owned[role], timeout=12)
            except Exception:
                errors.append(role+'-stop')
        for role in self.owned:
            complete = True
            try:
                self.inspect(role, security=False)
                self.logs(role, 'final-'+role, enforce=False)
            except Exception:
                complete = False
                errors.append(role+'-logs')
            if role in ('migrate', 'app'):
                try:
                    self.inspect(role, security=False)
                    self.trace(role, 'final-'+role+'-egress.jsonl', enforce=False)
                except Exception:
                    complete = False
                    errors.append(role+'-trace')
            if complete:
                self.preserved.add(role)
        if 'pg' in self.owned:
            try:
                self.inspect('pg', security=False)
                self.dump('final-disposable.pgdump')
                self.facts['final_snapshot'] = 'pg_dump_custom'
            except Exception:
                try:
                    v = self.inspect('pg', security=False)
                    if v['State']['Running']:
                        self.cmd.ok('stop', '--time', '5', self.owned['pg'], timeout=12)
                    v = self.inspect('pg', security=False)
                    require(not v['State']['Running'], 'raw-snapshot-pg-running')
                    path = self.binds['pg'][0][0]
                    require(path.parent == self.work/'pg' and not path.is_symlink(), 'raw-snapshot-owned-path')
                    _, out, _ = self.cmd.run(['sudo', '-n', 'tar', '--one-file-system', '-czf', '-', '-C', str(path), '.'], timeout=40, cap=128*MIB,
                                            stdout_name='final-disposable.pgdata.gz')
                    require(out.startswith(b'\x1f\x8b') and len(out) > 32, 'raw-snapshot-invalid')
                    self.facts['final_snapshot'] = 'stopped_pg_raw_data_not_rollback_backup'
                except Exception:
                    errors.append('database-preservation-failed')
        for role in reversed(list(self.owned)):
            try:
                v = self.inspect(role, security=False)
                if v['State']['Running']:
                    self.cmd.ok('stop', '--time', '5', self.owned[role], timeout=12)
                self.inspect(role, security=False)
                self.cmd.ok('rm', self.owned[role], timeout=12)
                ids = self.cmd.ok('ps', '-aq', '--no-trunc').decode().split()
                require(self.owned[role] not in ids, 'container-still-present')
            except Exception:
                errors.append(role+'-cleanup')
        self.facts['cleanup_verified'] = not errors
        self.facts['complete_logs_traces'] = set(self.owned) == self.preserved
        return errors


def run_trial(trial):
    failure = None
    try:
        trial.execute()
    except BaseException as exc:
        failure = str(exc) if isinstance(exc, Refused) else 'runtime-exception-'+type(exc).__name__
    finally:
        try:
            errors = trial.finish()
        except BaseException:
            errors = ['cleanup-exception']
        if trial.interrupted.is_set():
            failure = failure or 'runner-sigterm'
        policy_errors = sorted(set(trial.policy_failures))
        passed = not failure and not errors and not policy_errors and trial.facts.get('complete_logs_traces') is True and bool(trial.facts.get('final_snapshot'))
        result = {'status': 'PASS' if passed else 'FAIL', 'reason': failure, 'preservation_cleanup_errors': errors,
                  'transport_policy_errors': policy_errors,
                  'facts': trial.facts, 'business_acceptance': False, 'rollback_acceptance': False, 'global_launch': 'NO_GO'}
        trial.e.json('runtime-receipts.json', {'receipts': list(trial.e.receipts)})
        trial.e.json('runtime-result.json', result)
    return 0 if passed else 2


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('archive', 'manifest', 'pins'):
        parser.add_argument('--'+key, type=Path, required=True)
    args = parser.parse_args(argv)
    os.umask(0o077)
    interrupted = threading.Event()
    old = signal.signal(signal.SIGTERM, lambda *_: interrupted.set())
    evidence = None
    try:
        hosted_guard(os.environ)  # Must precede any Docker invocation or host mutation.
        private = Path(os.environ['HS_RUNTIME_PRIVATE'])
        evidence = Evidence(Path(os.environ['HS_RUNTIME_EVIDENCE']))
        require(private.is_dir() and not private.is_symlink(), 'private-directory')
        manifest = validate_manifest(read_json(args.manifest))
        pins = read_json(args.pins)
        require(set(pins) == {'postgres', 'redis'} and all(isinstance(v, str) and
                re.fullmatch(k+r'@sha256:[0-9a-f]{64}', v) for k, v in pins.items()), 'invalid-pins')
        return run_trial(Trial(evidence, private, manifest, pins, args.archive, interrupted))
    except BaseException as exc:
        reason = str(exc) if isinstance(exc, Refused) else 'preflight-exception-'+type(exc).__name__
        if evidence and not (evidence.root/'runtime-result.json').exists():
            evidence.json('runtime-result.json', {'status': 'FAIL', 'reason': reason,
                'business_acceptance': False, 'rollback_acceptance': False, 'global_launch': 'NO_GO'})
        print(json.dumps({'status': 'FAIL', 'reason': reason}), flush=True)
        return 2
    finally:
        signal.signal(signal.SIGTERM, old)


if __name__ == '__main__':
    raise SystemExit(main())
