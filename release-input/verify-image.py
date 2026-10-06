#!/usr/bin/env python3
"""Hosted only: inspect an existing built image, never start the application."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import importlib.util
spec = importlib.util.spec_from_file_location('frozen_source_verifier', Path(__file__).with_name('verify-source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ARCHIVE, MANIFEST, BASE = module.ARCHIVE, module.MANIFEST, module.BASE
load_manifest, digest = module.load_manifest, module.digest

IMAGE = 'hobbysalon-release-candidate:ack-20261006'
REQUIRED = [
    'package.json', 'yarn.lock', 'turbo.json', 'apps/backend/package.json',
    'deploy/release/migrate-native.cjs', 'deploy/release/migration-plan.cjs',
    'packages/modules/b2c-core/src/modules/marketplace/migrations/Migration20261006113000.ts',
    'packages/modules/b2c-core/src/utils/marketplace-capture-ack.ts',
    'packages/modules/b2c-core/src/utils/marketplace-capture-subscriber.ts',
    'packages/modules/b2c-core/src/utils/marketplace-capture.ts',
    'packages/modules/b2c-core/src/subscribers/split-payment-payment-captured.ts',
]

def check(condition, message):
    if not condition:
        raise ValueError(message)

def docker(*args):
    return subprocess.check_output(['docker', *args], text=True)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--inspector', type=Path, required=True)
    a = p.parse_args()
    check(a.out.is_dir() and not a.out.is_symlink(), 'Receipt directory must already exist')
    manifest = load_manifest(a.manifest)
    image = json.loads(docker('image', 'inspect', IMAGE))[0]
    image_id = image['Id']
    labels = image['Config'].get('Labels') or {}
    check(labels.get('org.opencontainers.image.revision') == BASE, 'Source base label mismatch')
    check(labels.get('io.hobbysalon.source.archive.sha256') == ARCHIVE, 'Archive label mismatch')
    check(labels.get('io.hobbysalon.source.manifest.sha256') == MANIFEST, 'Manifest label mismatch')
    cid = docker('create', '--network=none', '--read-only', '--cpus=1', '--memory=256m',
                 '--pids-limit=128', '--cap-drop=ALL', '--security-opt=no-new-privileges',
                 '--user=1001:1001', '--no-healthcheck', '--entrypoint=/bin/true', image_id).strip()
    try:
        docker('cp', cid + ':/release', str(a.out / 'baked'))
        docker('cp', cid + ':/usr/local/bin/release-entrypoint', str(a.out / 'entrypoint'))
    finally:
        docker('rm', cid)
    baked = a.out / 'baked'
    source = json.loads((baked / 'source.json').read_text())
    snapshot_hash = digest(baked / 'source.json')
    check((baked / 'source.sha256').read_text().strip() == snapshot_hash, 'Baked snapshot hash mismatch')
    seen = set()
    check(source.get('schema') == 2, 'Unexpected source snapshot schema')
    for d in source['files']:
        name = d['path']
        check(str(PurePosixPath(name)) == name and not name.startswith('/') and '..' not in name.split('/'), 'Unsafe baked source path')
        check(name not in seen and 'symlink' not in d, 'Duplicate/link baked source')
        check(name in manifest and manifest[name]['sha256'] == d.get('sha256'), 'Actual COPY source mismatch: ' + name)
        seen.add(name)
    check(set(REQUIRED).issubset(seen), 'Required actual COPY source paths absent')
    entrypoint_hash = digest(a.out / 'entrypoint')
    check(entrypoint_hash == manifest['apps/backend/entrypoint.sh']['sha256'], 'Actual entrypoint mismatch')
    # Run only this dependency-free inspector, with immutable image ID and no app imports.
    result = docker('run', '--rm', '--network=none', '--read-only', '--cpus=1', '--memory=256m',
                    '--pids-limit=128', '--cap-drop=ALL', '--security-opt=no-new-privileges',
                    '--user=1001:1001', '--no-healthcheck', '--entrypoint=node',
                    '--mount', 'type=bind,src=' + str(a.inspector.resolve()) + ',dst=/inspect.cjs,readonly',
                    image_id, '/inspect.cjs')
    compiled = json.loads(result)
    check(compiled.get('status') == 'PASS' and compiled.get('runtime_acceptance') is False, 'Inspector failed')
    check(compiled['source_snapshot_sha256'] == snapshot_hash, 'Inspector snapshot mismatch')
    check(compiled['entrypoint_sha256'] == entrypoint_hash, 'Inspector entrypoint mismatch')
    check(compiled['root_lock_sha256'] == manifest['yarn.lock']['sha256'], 'Actual runtime lock mismatch')
    (a.out / 'compiled.json').write_text(json.dumps(compiled, indent=2) + '\n')
    receipt = {'schema': 1, 'status': 'PASS', 'kind': 'build-only-image-inspection',
               'source_base_commit': BASE, 'archive_sha256': ARCHIVE, 'manifest_sha256': MANIFEST,
               'image_id': image_id, 'image_tag': IMAGE, 'source_snapshot_sha256': snapshot_hash,
               'actual_copy_files': source['files'], 'entrypoint_sha256': entrypoint_hash,
               'compiled_receipt_sha256': digest(a.out / 'compiled.json'),
               'production_release': False, 'runtime_acceptance': False}
    (a.out / 'image-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': 'PASS', 'image_id': image_id, 'runtime_acceptance': False}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('FAIL: ' + str(e), file=sys.stderr)
        sys.exit(2)
