#!/usr/bin/env python3
"""Opt-in NEW network-none/tmpfs PG; fixture-only, no provider or existing DB."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
PG = 'sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609'
NODE = 'sha256:f5ed65dae706d2718bbce313451c235dc53e79065389390021246c044f151a47'
ACK = 'new-network-none-tmpfs-no-effect-candidate'


def run(args, **kwargs):
    print('COMMAND', json.dumps(args), flush=True)
    return subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kwargs)


def inspect_isolation(name):
    result = run(['docker', 'inspect', name], timeout=10)
    result.check_returncode()
    data = json.loads(result.stdout)
    if len(data) != 1:
        raise RuntimeError('isolation inspect shape')
    c = data[0]
    if (c['Image'] != PG or c['HostConfig']['NetworkMode'] != 'none'
            or c['HostConfig']['ReadonlyRootfs'] is not True
            or '/tmp' not in c['HostConfig']['Tmpfs']
            or c['State']['Running'] is not True):
        raise RuntimeError('isolation inspect refused')
    print('ISOLATION_VERIFIED network=none readonly=true tmpfs=true image=' + PG, flush=True)


def main():
    socket = tempfile.mkdtemp(prefix='ne-candidate-', dir='/dev/shm')
    os.chmod(socket, 0o777)
    name = 'ne-candidate-' + uuid.uuid4().hex[:12]
    node_name = name + '-node'
    rc = 1
    node_started = False
    try:
        cmd = ['docker','run','-d','--name',name,'--pull=never','--network','none','--read-only',
               '--user','postgres','--cap-drop=ALL','--security-opt=no-new-privileges','--memory','256m',
               '--cpus','1','--pids-limit','100','--tmpfs','/tmp:rw,size=128m,mode=1777',
               '--tmpfs','/var/lib/postgresql/data:rw,size=1m,mode=1777',
               '--tmpfs','/var/run/postgresql:rw,size=1m,mode=1777','--mount',f'type=bind,src={socket},dst=/socket',
               '-e','PGDATA=/tmp/pgdata','--entrypoint','/bin/sh',PG,'-c',
               'initdb -D "$PGDATA" -A trust >/tmp/initdb.log 2>&1 && exec postgres -D "$PGDATA" -c listen_addresses= -c unix_socket_directories=/socket -c shared_buffers=32MB']
        started = run(cmd, timeout=20); print(started.stdout, flush=True); started.check_returncode()
        for _ in range(60):
            ready = run(['docker','exec',name,'pg_isready','-h','/socket','-U','postgres'], timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('new PostgreSQL server did not become ready')
        inspect_isolation(name)
        cmd = ['docker','run','--name',node_name,'--pull=never','--network','none','--read-only','--user','1000:1000',
               '--cap-drop=ALL','--security-opt=no-new-privileges','--memory','768m','--cpus','2','--pids-limit','256',
               '--entrypoint','node','-e','NODE_PATH=/app/node_modules','-e','NOEFFECT_CANDIDATE_SOCKET=/socket',
               '-e',f'NOEFFECT_CANDIDATE_ACK={ACK}','--mount',f'type=bind,src={socket},dst=/socket',
               '--mount',f'type=bind,src={ROOT},dst=/source,readonly','-w','/source',NODE,
               '--test','--test-reporter=tap','scripts/tests/helpers/no-effect-candidate-postgres.cjs']
        node_started = True  # Also clean up a container created before a launch timeout.
        result = run(cmd, timeout=100); print(result.stdout, flush=True); rc = result.returncode
        print('TEST_EXIT',rc,flush=True)
    except Exception as exc:
        print('RUNNER_FAILURE',type(exc).__name__,str(exc),flush=True)
        rc = 1
    finally:
        for container in ([node_name, name] if node_started else [name]):
            try:
                cleaned = run(['docker','rm','-f',container],timeout=20)
                print('CONTAINER_CLEANUP_EXIT',container,cleaned.returncode,flush=True)
                if cleaned.returncode != 0:
                    rc = 1
            except Exception as exc:
                print('CLEANUP_FAILURE',container,type(exc).__name__,flush=True)
                rc = 1
        try:
            shutil.rmtree(socket)
            removed = not Path(socket).exists()
            print('SOCKET_REMOVED',removed,flush=True)
            if not removed:
                rc = 1
        except Exception as exc:
            print('SOCKET_CLEANUP_FAILURE',type(exc).__name__,flush=True)
            rc = 1
    print('FINAL_EXIT',rc,flush=True)
    return rc


if __name__ == '__main__':
    raise SystemExit(main())
