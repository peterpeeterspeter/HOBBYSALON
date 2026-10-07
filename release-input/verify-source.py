#!/usr/bin/env python3
"""Verify the entire frozen input before extraction; no assertions or network."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import tarfile

ARCHIVE = MANIFEST = BASE = PATCH = None
PATCH_FILES = {}
BINDING = None

def initialize(root):
    global ARCHIVE, MANIFEST, BASE, PATCH, PATCH_FILES, BINDING
    import importlib.util
    spec = importlib.util.spec_from_file_location('bridge_signatures', Path(__file__).with_name('verify-signature.py'))
    verifier = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier)
    BINDING = verifier.verify(root)
    a = BINDING['approval']
    ARCHIVE, MANIFEST, BASE, PATCH = [a[k] for k in ['archive_sha256','manifest_sha256','base_commit','accepted_patch_sha256']]
    PATCH_FILES = a['accepted_file_sha256']

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
    parts = name.split('/')
    if any(x in ('.git','node_modules','__pycache__') for x in parts) or any(x.endswith(('.pem','.key','.p12','.pfx','.pyc')) for x in parts):
        fail('Secret/dependency path forbidden')
    if any(x.startswith('.env') for x in parts):
        if BINDING is None or name not in BINDING['approval']['bound_original_templates']:
            fail('Unbound secret/template path forbidden')
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
    if len(records) != BINDING['approval']['source_files'] or sum(d['size'] for d in records.values()) != BINDING['approval']['source_bytes']:
        fail('Manifest count/size mismatch')
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
    initialize(args.approval.parent)
    a = json.loads(args.approval.read_text())
    expected = BINDING['approval']
    if any(a.get(k) != v or type(a.get(k)) is not type(v) for k, v in expected.items()):
        fail('Approval binding mismatch')
    dest = args.dest.absolute()
    parent = dest.parent
    if parent.resolve() != parent or parent.stat().st_uid != os.getuid() or not parent.is_dir():
        fail('Destination parent must be locally owned and not symlinked')
    if parent.stat().st_mode & 0o022 or dest.exists() or dest.is_symlink():
        fail('Destination must be absent under a non-writable-by-others parent')
    if digest(args.archive) != ARCHIVE:
        fail('Archive hash mismatch')
    records = load_manifest(args.manifest)
    for name in a['bound_original_templates']:
        if records.get(name,{}).get('sha256') != a['bound_original_templates'][name]: fail('Original template binding mismatch')
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
