import hashlib,json,tarfile,sys
from pathlib import Path
b=Path('release-input');approval=json.loads((b/'approval.json').read_text());manifest=json.loads((b/'approved-context-manifest.json').read_text())
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert h(b/'approved-context.tar.gz')==approval['context_archive_sha256'],'ARCHIVE_HASH'
assert h(b/'approved-context-manifest.json')==approval['context_manifest_sha256'],'MANIFEST_HASH'
dest=Path('/tmp/approved-context');dest.mkdir(exist_ok=False)
with tarfile.open(b/'approved-context.tar.gz','r:gz') as tar:
 members=tar.getmembers()
 assert len(members)==len(manifest) and all(m.isfile() and m.name in manifest and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members),'ARCHIVE_SCOPE'
 for m in members:
  data=tar.extractfile(m).read();assert hashlib.sha256(data).hexdigest()==manifest[m.name],'FILE_HASH'
  p=dest/m.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(m.mode)
assert {str(p.relative_to(dest)):h(p) for p in dest.rglob('*') if p.is_file()}==manifest
assert h(dest/'apps/backend/Dockerfile')==approval['dockerfile_sha256']
assert h(dest/'yarn.lock')==approval['root_lock_sha256']
print('APPROVED_CONTEXT_VERIFIED',len(manifest),approval['context_archive_sha256'])
