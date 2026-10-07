#!/usr/bin/env python3
"""Verify the entire frozen input before extraction; no assertions or network."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import tarfile

ARCHIVE = '47ce7aaf7045bc7006e896845bae013b9368f04520b10b20ba05edbc1174b1c1'
MANIFEST = 'd9ec2c9fbc51d77808b72a0ddd24694c437f072126fcb7919487a5a40703de02'
BASE = 'bb33a1c1a41e3ac47973badf9283d1330eb9525e'
PATCH = '892c33cd8b484a4ab906a0087ca27fcd8d5b7f26736a29cf0d08b4931bae85c8'
PATCH_FILES = {'package.json': 'bf085e8c11b662f851b5202cd4448a5fc740290c00c06ca23964d2194d4dc599', 'yarn.lock': 'fc0d51491548834c643a39416ce1461f9b61b3cca119c410f82e2bdfb3e77b98', 'turbo.json': '7b4600964e0ab5778a7e641b588fb195d3438585048d8ad9e11d009e7714178a', 'apps/backend/Dockerfile': '155ef12fc5094994bf057d7c2a44f62b571821b8d4089e1c9e177e015292abb7', 'apps/backend/entrypoint.sh': 'abc173a11ab7e0457ccaf11c9ce71ccebff0b8b01881ca41910a2c42ce9f462e', 'deploy/release/archive-runtime.cjs': '44c1669a48978c4353e9e49a605d05b904755e368b11f173dbaf6d782d69f3b4', 'deploy/release/audit-dependencies.cjs': '5369e834cbd7f038b3f4cff9183d506f791829d59fc3fb6324e7214875438ff0', 'deploy/release/index-bootstrap.cjs': 'fb57075bf3e04893a88fc850f6c6cc46225d03bfcc9e894fbcdba4693233249a', 'deploy/release/migrate-native.cjs': 'fd029c4ee405996f1a6836379c8612a374c859d5e3e731a3854c4534d515ef90', 'deploy/release/migration-plan.cjs': 'e449b9274e479651a7245bdf6d2e1bf69447846317ebb47bc3a05286a68019d6', 'deploy/release/recipe.sh': 'ebbb36171095076a98e9211414f53de42b011498bcac3c533613d0ea35e61f2e', 'deploy/release/verify-offline.cjs': 'd7fa9bfc51db45be35706571b9e0ab5078c951698a342039d876e16586cee063'}

def fail(message):
    raise ValueError(message)

def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def safe_path(name):
    if not isinstance(name, str) or not name or '\\' in name or '\x00' in name:
        fail('Invalid path')
    p = PurePosixPath(name)
    if p.is_absolute() or any(x in ('', '.', '..') for x in name.split('/')) or str(p) != name:
        fail('Unsafe relative path')
    return name

def load_manifest(path):
    if digest(path) != MANIFEST:
        fail('Manifest hash mismatch')
    records = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            d = json.loads(line)
            name = safe_path(d['path'])
            if name in records or d['type'] != 'file' or d['git_mode'] not in ('100644', '100755'):
                fail('Manifest duplicate/type/mode mismatch')
            if type(d['size']) is not int or d['size'] < 0 or len(d['sha256']) != 64:
                fail('Manifest size/hash invalid')
            records[name] = d
    if len(records) != 1332 or sum(d['size'] for d in records.values()) != 3532368:
        fail('Manifest count/size mismatch')
    # Root Docker context control file is required, not a directory or an extra COPY root.
    if records.get('.dockerignore', {}).get('sha256') != 'c237bacce89343d64ca455b56d0345e7bba4b27a467a9415a6babc9272c89782':
        fail('Root Docker ignore binding mismatch')
    for name, expected in PATCH_FILES.items():
        if records.get(name, {}).get('sha256') != expected:
            fail('Accepted patch binding mismatch')
    return records

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--archive', type=Path, required=True)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--approval', type=Path, required=True)
    p.add_argument('--dest', type=Path, required=True, help='Absent child of an owned non-symlink directory')
    p.add_argument('--verify-only', action='store_true', help='Read/hash only; never extract or create destination')
    args = p.parse_args()
    a = json.loads(args.approval.read_text())
    expected = {'base_commit': BASE, 'archive_sha256': ARCHIVE, 'manifest_sha256': MANIFEST,
                'accepted_patch_sha256': PATCH, 'accepted_file_sha256': PATCH_FILES,
                'build_only': True, 'production_release': False, 'runtime_acceptance': False,
                'branch': 'ops/release-validation-20261007', 'max_build_minutes': 40,
                'artifact_retention_days': 7, 'maximum_hosted_builds': 4,
                'image': 'hobbysalon-release-candidate:20261007', 'repository': 'peterpeeterspeter/HOBBYSALON',
                'dockerfile': 'apps/backend/Dockerfile', 'schema': 1,
                'source_scope': ['.dockerignore', 'package.json', 'yarn.lock', 'turbo.json', 'packages', 'apps/backend', 'deploy/release'],
                'source_files': 1332, 'source_bytes': 3532368,
                'dockerignore_sha256': 'c237bacce89343d64ca455b56d0345e7bba4b27a467a9415a6babc9272c89782',
                'exclusions_sha256': 'f5af2bfcea1403c167210efd8fb78cdfef00db75a7681c73ea610865376ec9ac'}
    if any(a.get(k) != v or type(a.get(k)) is not type(v) for k, v in expected.items()):
        fail('Approval binding mismatch')
    if digest(args.approval.with_name('source-exclusions.json')) != a['exclusions_sha256']:
        fail('Exclusions hash mismatch')
    dest = args.dest.absolute()
    parent = dest.parent
    if parent.resolve() != parent or parent.stat().st_uid != os.getuid() or not parent.is_dir():
        fail('Destination parent must be locally owned and not symlinked')
    if parent.stat().st_mode & 0o022 or dest.exists() or dest.is_symlink():
        fail('Destination must be absent under a non-writable-by-others parent')
    if digest(args.archive) != ARCHIVE:
        fail('Archive hash mismatch')
    records = load_manifest(args.manifest)
    seen = set()
    total = 0
    with tarfile.open(args.archive, 'r:xz') as archive:
        for m in archive:
            name = safe_path(m.name)
            d = records.get(name)
            if name in seen or d is None or not m.isreg() or m.linkname or m.mode not in (0o644, 0o755):
                fail('Archive path/type/mode mismatch')
            if m.size != d['size'] or m.mode != int(d['git_mode'][-3:], 8):
                fail('Archive size/mode mismatch')
            total += m.size
            if total > 100_000_000:
                fail('Source exceeds 100MB limit')
            h = hashlib.sha256()
            with archive.extractfile(m) as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    h.update(chunk)
            if h.hexdigest() != d['sha256']:
                fail('Archive member hash mismatch')
            seen.add(name)
    if seen != set(records):
        fail('Archive count/path set mismatch')
    if not args.verify_only:
        # Private new tree, never tar.extractall; original source remains untouched.
        dest.mkdir(mode=0o700)
        with tarfile.open(args.archive, 'r:xz') as archive:
            for m in archive:
                d = records[safe_path(m.name)]
                target = dest / m.name
                target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with archive.extractfile(m) as src, target.open('xb') as out:
                    for chunk in iter(lambda: src.read(1024 * 1024), b''):
                        out.write(chunk)
                if digest(target) != d['sha256']:
                    fail('Extraction readback mismatch')
                target.chmod(int(d['git_mode'][-3:], 8))
        # Docker COPY must not inherit owner-only directory traversal permissions.
        for root, dirs, _ in os.walk(dest):
            for name in dirs:
                (Path(root) / name).chmod(0o755)
    print(json.dumps({'status': 'PASS', 'files': len(seen), 'source_bytes': total,
                      'archive_sha256': ARCHIVE, 'manifest_sha256': MANIFEST,
                      'extracted': not args.verify_only, 'runtime_acceptance': False}, sort_keys=True))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('FAIL: ' + str(e), file=__import__('sys').stderr)
        raise SystemExit(2)
