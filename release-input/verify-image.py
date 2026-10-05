import json,hashlib,subprocess,tarfile,io
from pathlib import Path
out=Path('release-output');out.mkdir(exist_ok=True)
assert not (out/'build-acceptance.json').exists(),'NO_STALE_ACCEPTANCE'
tag='hobbysalon-release-candidate:recovery-20261005'
ident=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
container=subprocess.check_output(['docker','create','--network','none','--entrypoint','/bin/true',tag],text=True).strip()
try:
 subprocess.run(['docker','cp',container+':/release',str(out/'release')],check=True)
 subprocess.run(['docker','cp',container+':/usr/local/bin/release-entrypoint',str(out/'entrypoint.sh')],check=True)
finally:subprocess.run(['docker','rm',container],check=True)
release=out/'release';source=json.loads((release/'source.json').read_text());installed=json.loads((release/'dependencies.json').read_text())
approval=json.loads(Path('release-input/approval.json').read_text());context=json.loads(Path('release-input/approved-context-manifest.json').read_text())
for f in source['files']:
 assert 'sha256' in f and context.get(f['path'])==f['sha256'],('BAKED_SOURCE_MISMATCH',f['path'])
assert installed['release_acceptance'] is True and installed['parity_pass'] is True,'INSTALLED_PARITY'
assert installed['root_lock_sha256']==approval['root_lock_sha256'],'LOCK_HASH'
assert hashlib.sha256((release/'source.json').read_bytes()).hexdigest()==(release/'source.sha256').read_text().strip(),'SOURCE_RECEIPT_HASH'
artifact_script=r'''const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const roots=['/app/apps/backend/.medusa/server','/app/packages/framework/dist'];for(const name of fs.readdirSync('/app/packages/modules'))roots.push('/app/packages/modules/'+name+'/.medusa/server');let files=[];function walk(d){if(!fs.existsSync(d))throw Error('COMPILED_ROOT_ABSENT');for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.medusa','static'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.isFile())files.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')})}}for(const root of roots)walk(root);for(const required of ['/app/apps/backend/.medusa/server/medusa-config.js','/app/packages/framework/dist/index.js'])if(!files.some(f=>f.path===required))throw Error('COMPILED_ENTRY_ABSENT');console.log(JSON.stringify(files.sort((a,b)=>a.path.localeCompare(b.path))))'''
art=json.loads(subprocess.check_output(['docker','run','--rm','--network','none','--read-only','--memory','128m','--entrypoint','node',tag,'-e',artifact_script]))
assert art and all(f['sha256'] for f in art)
(release/'artifacts.json').write_text(json.dumps(art,indent=2)+'\n')
assert hashlib.sha256((out/'entrypoint.sh').read_bytes()).hexdigest()==context['apps/backend/entrypoint.sh'],'ENTRYPOINT_HASH'
receipt={'immutable_image_id':ident['Id'],'approved_context_sha256':approval['context_archive_sha256'],'dockerfile_sha256':approval['dockerfile_sha256'],'frozen_source_manifest_sha256':approval['approved_source_manifest_sha256'],'root_lock_sha256':installed['root_lock_sha256'],'installed_package_count':installed['installed_package_count'],'frozen_dependency_audit_pass':True,'compiled_artifact_count':len(art),'baked_source_files':len(source['files']),'compiled_runtime_layout_present':True,'runtime_acceptance':False,'production_release':False,'image_config':{k:ident['Config'].get(k) for k in ['User','WorkingDir','Entrypoint','Cmd','Labels']}}
(out/'image-id.txt').write_text(ident['Id']+'\n')
(out/'build-acceptance.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
