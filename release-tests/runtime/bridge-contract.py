#!/usr/bin/env python3
"""Fail-closed PhaseB identity. JSON is first-class, original previous is historical only."""
import hashlib, importlib.util, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SPEC=json.loads((ROOT/'bridge-contract.json').read_text())
class Blocked(RuntimeError): pass
def need(ok,code):
    if not ok: raise Blocked(code)
def sha(value): return isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value)
def image(value): return isinstance(value,str) and re.fullmatch('sha256:[a-f0-9]{64}',value)
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def validate(c):
    need(isinstance(c,dict) and c.get('status')=='BOUND_BUILD_ONLY','BRIDGE_BUILD_BINDING_PENDING')
    for key in ['schema','kind','repository','branch','ref','artifact_name','run_attempt','source_file_count','historical_previous','candidate']:
        need(c.get(key)==SPEC[key],'BRIDGE_FIXED_CONTRACT_CHANGED')
    need(c.get('runtime_acceptance') is False and c.get('deployment') is False,'BRIDGE_NOT_ACCEPTANCE')
    b=c.get('binding');need(isinstance(b,dict),'BRIDGE_PINS_REQUIRED')
    for key in ['artifact_id','run_id','zip_bytes','gzip_bytes']:
        need(type(b.get(key)) is int and b[key]>0,'BRIDGE_INTEGER_PIN')
    for key in ['zip_sha256','gzip_sha256','source_hash','source_archive_sha256','source_manifest_sha256','build_receipt_sha256','parent_pins_sha256','source_attestation_sha256','source_signature_sha256','source_public_key_sha256','source_workflow_sha256','source_approval_sha256']:
        need(bool(sha(b.get(key))),'BRIDGE_DIGEST_PIN')
    for key in ['commit','parent_commit','source_base_commit']:
        need(isinstance(b.get(key),str) and re.fullmatch('[a-f0-9]{40}',b[key]),'BRIDGE_SOURCE_COMMIT_PIN')
    need(image(b.get('image')) and b['image'] not in [SPEC['candidate']['image'],SPEC['historical_previous']['image']],'EXACT_DISTINCT_BRIDGE_REQUIRED')
    need(b['commit']!=SPEC['candidate']['commit'],'BRIDGE_NOT_CANDIDATE_SOURCE')
    layers=b.get('diff_ids');need(isinstance(layers,list) and 0<len(layers)<=128 and all(image(x) for x in layers),'BRIDGE_LAYER_PINS')
    need(isinstance(b.get('workflow_path'),str) and re.fullmatch(r'\.github/workflows/[a-z0-9-]+\.yml',b['workflow_path']),'BRIDGE_WORKFLOW_PIN')
    return b

def load(path): return validate(json.loads(Path(path).read_text()))
def engine(b):
    a=module('immutable_bridge_acquisition','acquire.py')
    # A fresh module instance, never mutate the original historical acquisition module.
    for k,v in {'ARTIFACT':b['artifact_id'],'RUN':b['run_id'],'COMMIT':b['commit'],
                'ZIP_BYTES':b['zip_bytes'],'ZIP_SHA':b['zip_sha256'],'GZIP_BYTES':b['gzip_bytes'],
                'GZIP_SHA':b['gzip_sha256'],'IMAGE':b['image'],'SOURCE':b['source_hash']}.items():setattr(a,k,v)
    return a

def metadata(c,a,r,branch,main):
    b=validate(c)
    need(a.get('id')==b['artifact_id'] and a.get('name')==c['artifact_name'] and a.get('size_in_bytes')==b['zip_bytes'] and a.get('expired') is False and a.get('digest')=='sha256:'+b['zip_sha256'],'BRIDGE_ARTIFACT_IDENTITY')
    aw=a.get('workflow_run',{})
    need(aw.get('id')==b['run_id'] and aw.get('head_sha')==b['commit'] and aw.get('head_branch')==c['branch'],'BRIDGE_ARTIFACT_RUN_BRANCH')
    need(r.get('id')==b['run_id'] and r.get('head_sha')==b['commit'] and r.get('head_branch')==c['branch'] and r.get('event')=='push' and r.get('run_attempt')==1 and r.get('status')=='completed' and r.get('conclusion')=='success' and r.get('path')==b['workflow_path'] and r.get('repository',{}).get('full_name')==c['repository'],'BRIDGE_SUCCESSFUL_ATTEMPT_ONE')
    need(branch.get('ref')==c['ref'] and branch.get('object',{}).get('sha')==b['commit'],'BRIDGE_BRANCH_REF_PIN')
    need(main.get('ref')=='refs/heads/main' and re.fullmatch('[a-f0-9]{40}',main.get('object',{}).get('sha','')),'BRIDGE_MAIN_OBSERVATION')
    return {'artifact_id':b['artifact_id'],'run_id':b['run_id'],'commit':b['commit'],'branch':c['branch'],'artifact_name':c['artifact_name'],'main_sha':main['object']['sha']}

def verify_manifest(m,b):
    for k,v in {'image':b['image'],'image_id':b['image'],'source_hash':b['source_hash'],'gzip_sha256':b['gzip_sha256'],'gzip_bytes':b['gzip_bytes'],'diff_ids':b['diff_ids']}.items():need(m.get(k)==v,'BRIDGE_ACQUIRED_PIN_MISMATCH')
    for k in ['config_sha256_verified','ordered_layer_sha256_verified','source_receipt_verified','source_export_verified','image_source_bytes_verified','image_source_labels_verified','actual_copy_pathset_verified','build_receipt_source_verified','source_signature_verified']:
        need(m.get(k) is True,'BRIDGE_IMMUTABLE_RECEIPT_REQUIRED')
    need(m.get('identity_kind')=='distinct-rollback-bridge' and m.get('contract_sha256')==b['contract_sha256'],'BRIDGE_CONTRACT_RECEIPT_REQUIRED')
    return m['diff_ids']

# Verify actual bytes inside the saved image layers, not a local source tree or receipt assertion.
# Refuse unsupported compressed-layer/whiteout/link layouts instead of weakening checks.
def image_source_bytes(archive,b,manifest_bytes,source_bytes,receipt_bytes=None,compiled_bytes=None):
    import gzip,tarfile
    review=copy_review()
    verify_copy_receipt(b,manifest_bytes,source_bytes,receipt_bytes,compiled_bytes,review)
    # Installer COPY snapshot != final runtime archive. archive-runtime.cjs copies
    # manifests/CJS plus generated code/dependencies, NOT all original TS or turbo.
    wanted={('app/'+p):digest for p,digest in review['runtime_source_files'].items()}
    wanted['usr/local/bin/release-entrypoint']=review['source_files']['apps/backend/entrypoint.sh']
    wanted['release/source.json']=b['source_hash']
    wanted['release/source.sha256']=None
    observed={};labels=None;layer_observations={}
    with gzip.open(archive,'rb') as gz,tarfile.open(fileobj=gz,mode='r|') as outer:
        for blob in outer:
            name=blob.name
            if name=='blobs/sha256/'+b['image'].split(':')[1]:
                config=json.load(outer.extractfile(blob));labels=config.get('config',{}).get('Labels',{})
            if name not in ['blobs/sha256/'+x.split(':')[1] for x in b['diff_ids']]:continue
            # Each layer already hash-verified by immutable acquire.inspect_image.
            current={};layer_observations[name]=current
            with tarfile.open(fileobj=outer.extractfile(blob),mode='r|') as layer:
                for member in layer:
                    path=member.name.removeprefix('./').rstrip('/')
                    need(not path.startswith('/') and '..' not in path.split('/'),'BRIDGE_LAYER_PATH')
                    # Docker whiteouts remove the named sibling subtree; opaque
                    # markers hide every lower-layer child of their directory.
                    # Derive affected ancestors from exact required paths, never
                    # from receipt hashes or the current observed-file map.
                    parts=[part for part in path.split('/') if part not in ('','.')] 
                    path='/'.join(parts)
                    for index,part in enumerate(parts):
                        if not part.startswith('.wh.'):continue
                        parent='/'.join(parts[:index])
                        if part=='.wh..wh..opq':
                            affected=any(not parent or p.startswith(parent+'/') for p in wanted)
                        else:
                            target='/'.join(parts[:index]+[part[4:]])
                            affected=any(p==target or p.startswith(target+'/') for p in wanted)
                        need(not affected,'BRIDGE_SOURCE_WHITEOUT_UNSUPPORTED')
                    if member.issym() or member.islnk():
                        need(not any(p==path or p.startswith(path+'/') for p in wanted),'BRIDGE_SOURCE_ANCESTOR_LINK')
                    if any(p.startswith(path+'/') for p in wanted):
                        need(member.isdir(),'BRIDGE_SOURCE_ANCESTOR_ENTRY_UNSUPPORTED')
                    if path not in wanted:continue
                    need(path not in current,'BRIDGE_SOURCE_LAYER_DUPLICATE')
                    need(member.isfile() and not member.issym() and not member.islnk() and member.size<=64*1024*1024,'BRIDGE_SOURCE_ENTRY_UNSUPPORTED')
                    data=layer.extractfile(member).read(64*1024*1024+1)
                    need(len(data)==member.size,'BRIDGE_SOURCE_ENTRY_BYTES')
                    current[path]=hashlib.sha256(data).hexdigest() if wanted[path] is not None else data.decode('ascii').strip()
    for digest in b['diff_ids']:
        name='blobs/sha256/'+digest.split(':')[1]
        need(name in layer_observations,'BRIDGE_SOURCE_LAYER_MISSING')
        observed.update(layer_observations[name])
    need(isinstance(labels,dict),'BRIDGE_IMAGE_LABELS_REQUIRED')
    for k,v in [('org.opencontainers.image.revision',b['source_base_commit']),('io.hobbysalon.source.archive.sha256',b['source_archive_sha256']),('io.hobbysalon.source.manifest.sha256',b['source_manifest_sha256'])]:need(labels.get(k)==v,'BRIDGE_IMAGE_SOURCE_LABEL')
    for k,v in [('io.hobbysalon.bridge.publication.commit',b['commit']),('io.hobbysalon.bridge.branch',SPEC['branch'])]:need(labels.get(k)==v,'BRIDGE_IMAGE_PUBLICATION_LABEL')
    for path,digest in wanted.items():need(observed.get(path)==(b['source_hash'] if digest is None else digest),'BRIDGE_ACTUAL_EXPORTED_SOURCE_MISMATCH')
    return {'source_export_verified':True,'image_source_bytes_verified':True,'image_source_labels_verified':True,'actual_copy_pathset_verified':True,'build_receipt_source_verified':True}

def copy_review():
    return json.loads((ROOT/'bridge-copy-review.json').read_text())

def manifest_map(data):
    rows={}
    for line in data.splitlines():
        row=json.loads(line);path=row.get('path');digest=row.get('sha256')
        need(isinstance(path,str) and path and '\\' not in path and all(p not in ('','.','..') for p in path.split('/')) and sha(digest),'BRIDGE_SOURCE_MANIFEST_PATH')
        need(path not in rows,'BRIDGE_SOURCE_MANIFEST_DUPLICATE')
        need(row.get('type')=='file' and row.get('git_mode') in ['100644','100755'] and type(row.get('size')) is int and row['size']>=0,'BRIDGE_SOURCE_MANIFEST_LAYOUT_UNSUPPORTED')
        rows[path]=digest
    return rows

def verify_copy_receipt(b,manifest_bytes,source_bytes,receipt_bytes,compiled_bytes,review=None):
    review=review or copy_review()
    need(hashlib.sha256(manifest_bytes).hexdigest()==b['source_manifest_sha256'],'BRIDGE_SOURCE_MANIFEST_PIN')
    expected=manifest_map(manifest_bytes)
    need(len(expected)==SPEC['source_file_count'] and expected==review['source_files'],'BRIDGE_REVIEWED_SOURCE_EXACT_PATH_HASH_SET')
    need(hashlib.sha256(source_bytes).hexdigest()==b['source_hash'],'BRIDGE_SNAPSHOT_IMAGE_SOURCE_HASH_MISMATCH')
    source=json.loads(source_bytes)
    need(isinstance(source,dict) and set(source)=={'schema','files'} and source['schema']==2 and isinstance(source['files'],list),'BRIDGE_COPY_SNAPSHOT_SCHEMA')
    actual={}
    for row in source['files']:
        need(isinstance(row,dict) and set(row)=={'path','sha256'} and isinstance(row['path'],str) and sha(row['sha256']),'BRIDGE_COPY_SNAPSHOT_ROW')
        need(row['path'] not in actual,'BRIDGE_COPY_SNAPSHOT_DUPLICATE')
        actual[row['path']]=row['sha256']
    need(actual==review['copy_files'],'BRIDGE_EXACT_DOCKER_COPY_PATH_HASH_SET')
    need(receipt_bytes is not None and compiled_bytes is not None,'BRIDGE_ACTUAL_BUILD_RECEIPTS_REQUIRED')
    need(hashlib.sha256(receipt_bytes).hexdigest()==b['build_receipt_sha256'],'BRIDGE_ACTUAL_BUILD_RECEIPT_HASH')
    r=json.loads(receipt_bytes)
    for key,val in {'schema':1,'status':'PASS','kind':'build-only-image-inspection','image_id':b['image'],'source_snapshot_sha256':b['source_hash'],'source_base_commit':b['source_base_commit'],'publication_head':b['commit'],'publication_branch':SPEC['branch'],'archive_sha256':b['source_archive_sha256'],'manifest_sha256':b['source_manifest_sha256'],'runtime_acceptance':False,'production_release':False}.items():
        need(r.get(key)==val and type(r.get(key)) is type(val),'BRIDGE_ACTUAL_BUILD_RECEIPT_BINDING')
    need(r.get('actual_copy_files')==source['files'],'BRIDGE_ACTUAL_COPY_FILES_RECEIPT_MISMATCH')
    need(r.get('compiled_receipt_sha256')==hashlib.sha256(compiled_bytes).hexdigest(),'BRIDGE_COMPILED_RECEIPT_HASH')
    compiled=json.loads(compiled_bytes)
    for key,val in {'status':'PASS','runtime_acceptance':False,'source_snapshot_sha256':b['source_hash'],'entrypoint_sha256':review['source_files']['apps/backend/entrypoint.sh'],'root_lock_sha256':review['source_files']['yarn.lock']}.items():need(compiled.get(key)==val,'BRIDGE_COMPILED_SOURCE_BINDING')
    need(r.get('entrypoint_sha256')==compiled['entrypoint_sha256'],'BRIDGE_RECEIPT_ENTRYPOINT_BINDING')
    return actual

def authenticate_source(root,b):
    """Real generated signatures, parent-pinned key and signed manifest/workflow."""
    import subprocess
    root=Path(root)
    files={'source-attestation.json':'source_attestation_sha256','source-attestation.sig':'source_signature_sha256','source-attestation-public.pem':'source_public_key_sha256','approval.json':'source_approval_sha256','source.full.manifest.jsonl':'source_manifest_sha256'}
    for name,pin in files.items():
        path=root/name
        need(path.is_file() and not path.is_symlink() and path.stat().st_size<=4*1024*1024,'BRIDGE_SIGNED_SOURCE_FILE_REQUIRED')
        need(hashlib.sha256(path.read_bytes()).hexdigest()==b[pin],'BRIDGE_SIGNED_SOURCE_PARENT_PIN')
    workflow=root.parent/'.github/workflows/rollback-bridge-build.yml'
    need(workflow.is_file() and not workflow.is_symlink() and hashlib.sha256(workflow.read_bytes()).hexdigest()==b['source_workflow_sha256'],'BRIDGE_SIGNED_WORKFLOW_PIN')
    result=subprocess.run(['openssl','pkeyutl','-verify','-rawin','-pubin','-inkey',str(root/'source-attestation-public.pem'),'-in',str(root/'source-attestation.json'),'-sigfile',str(root/'source-attestation.sig')],capture_output=True,timeout=30)
    need(result.returncode==0,'BRIDGE_SOURCE_SIGNATURE_INVALID')
    att=json.loads((root/'source-attestation.json').read_bytes());approval=json.loads((root/'approval.json').read_bytes())
    need(att.get('kind')=='rollback-bridge-build-source' and att.get('workflow_sha256')==b['source_workflow_sha256'],'BRIDGE_SIGNATURE_SCOPE')
    for name,pin in [('source.full.manifest.jsonl','source_manifest_sha256'),('source.full.tar.xz','source_archive_sha256'),('approval.json','source_approval_sha256'),('source-attestation-public.pem','source_public_key_sha256')]:need(att.get('files',{}).get(name)==b[pin],'BRIDGE_SIGNATURE_FILE_BINDING')
    for key,val in [('archive_sha256',b['source_archive_sha256']),('manifest_sha256',b['source_manifest_sha256']),('base_commit',b['source_base_commit']),('source_files',SPEC['source_file_count']),('branch',SPEC['branch']),('build_only',True),('runtime_acceptance',False),('production_release',False)]:need(approval.get(key)==val,'BRIDGE_SIGNED_APPROVAL_BINDING')
    need(sha(att.get('parent_seal_sha256')) and att['parent_seal_sha256']==approval.get('parent_seal_sha256'),'BRIDGE_SIGNED_PARENT_REVIEW_REQUIRED')
    return {'source_signature_verified':True}
