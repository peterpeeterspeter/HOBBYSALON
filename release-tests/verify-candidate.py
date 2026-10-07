#!/usr/bin/env python3
"""Exact successful hosted build binding, archive/config/source verification; no registry."""
import argparse, hashlib, json, os, re, subprocess, sys, urllib.request
from pathlib import Path
REPO = 'peterpeeterspeter/HOBBYSALON'
RUN = 37613802325
COMMIT = 'bc94cd59b3ba415e77c5691ed3ec6ce88cc82700'
ARTIFACT_NAME = 'release-candidate-20261007'
ARTIFACT_ID = 11478492446
ARTIFACT_DIGEST = 'sha256:19711011efb7dec4dded8a9c36146fb61d9a22a8c32a57d639e9746dd65ce868'
ARTIFACT_SIZE = 275581555
IMAGE = 'hobbysalon-release-candidate:20261007'
ROOT = Path(__file__).resolve().parent.parent

def require(ok, code):
    if not ok: raise RuntimeError(code)

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()

def github_json(token, artifacts=False):
    # Only these two fixed, read-only endpoints for the exact candidate run.
    endpoint = f'https://api.github.com/repos/{REPO}/actions/runs/{RUN}'
    if artifacts: endpoint += '/artifacts?per_page=100'
    req = urllib.request.Request(endpoint, headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read(1024*1024+1)
    require(len(raw)<=1024*1024, 'API_BOUND')
    return json.loads(raw)

def artifact_metadata(d):
    require(isinstance(d, dict), 'ARTIFACT_LIST_REQUIRED')
    rows = d.get('artifacts')
    require(isinstance(rows, list) and type(d.get('total_count')) is int and d['total_count']==len(rows) and len(rows)<=100 and all(isinstance(row, dict) for row in rows), 'ARTIFACT_LIST_BOUND')
    matches = [row for row in rows if row.get('name')==ARTIFACT_NAME]
    require(len(matches)==1, 'UNIQUE_CANDIDATE_ARTIFACT_REQUIRED')
    a = matches[0]
    run = a.get('workflow_run')
    require(isinstance(run, dict) and type(run.get('id')) is int and run['id']==RUN and run.get('head_sha')==COMMIT and run.get('head_branch')=='ops/release-validation-20261007', 'ARTIFACT_BUILD_BINDING')
    require(type(a.get('id')) is int and a['id']>0, 'ARTIFACT_ID_REQUIRED')
    require(a.get('expired') is False, 'UNEXPIRED_ARTIFACT_REQUIRED')
    require(isinstance(a.get('digest'), str) and re.fullmatch(r'sha256:[0-9a-f]{64}', a['digest']), 'ARTIFACT_DIGEST_REQUIRED')
    require(type(a.get('size_in_bytes')) is int and a['size_in_bytes']>0, 'ARTIFACT_SIZE_REQUIRED')
    require(a['id']==ARTIFACT_ID and a['digest']==ARTIFACT_DIGEST and a['size_in_bytes']==ARTIFACT_SIZE, 'PINNED_ARTIFACT_METADATA_REQUIRED')
    return a

def binding():
    token = os.environ.pop('GH_TOKEN', '')
    require(bool(token), 'SCOPED_READ_TOKEN_REQUIRED')
    d = github_json(token)
    require(d.get('id')==RUN and d.get('head_sha')==COMMIT and d.get('status')=='completed' and d.get('conclusion')=='success' and d.get('run_attempt')==1 and d.get('event')=='push' and d.get('head_branch')=='ops/release-validation-20261007' and d.get('repository',{}).get('full_name')==REPO and d.get('path')=='.github/workflows/backend-ack-build.yml', 'EXACT_SUCCESSFUL_BUILD_REQUIRED')
    # No artifact query or download is possible before the successful-build guard.
    a = artifact_metadata(github_json(token, artifacts=True))
    if os.environ.get('GITHUB_OUTPUT'):
        with Path(os.environ['GITHUB_OUTPUT']).open('a') as output:
            output.write('artifact_id='+str(a['id'])+'\n')
    print('PASS: exact successful build binding')
    return a

def docker(*args):
    return subprocess.check_output(['docker',*args], text=True, stderr=subprocess.PIPE)

def verify(a):
    approval = json.loads((ROOT/'release-input/approval.json').read_text())
    receipt = json.loads((a.artifact/'image-receipt.json').read_text())
    image = receipt.get('image_id','')
    require(re.fullmatch(r'sha256:[0-9a-f]{64}',image), 'CONFIG_ID_REQUIRED')
    require(receipt.get('status')=='PASS' and receipt.get('kind')=='build-only-image-inspection' and receipt.get('production_release') is False and receipt.get('runtime_acceptance') is False, 'BUILD_INSPECTION_REQUIRED')
    for rk,ak in [('source_base_commit','base_commit'),('archive_sha256','archive_sha256'),('manifest_sha256','manifest_sha256')]:
        require(receipt.get(rk)==approval[ak], 'FROZEN_SOURCE_BINDING')
    require(json.loads((a.artifact/'build-metadata-projected.json').read_text()).get('containerimage.config.digest')==image,'BUILD_CONFIG_BINDING')
    declared = (a.artifact/'backend-image.sha256').read_text().split()
    require(len(declared)==2 and re.fullmatch('[0-9a-f]{64}',declared[0]) and Path(declared[1]).name=='backend-image.tar.gz', 'ARCHIVE_HASH_FORMAT')
    require(digest(a.artifact/'backend-image.tar.gz')==declared[0], 'ARCHIVE_SHA256')
    require(digest(a.artifact/'baked/source.json')==receipt.get('source_snapshot_sha256') and (a.artifact/'baked/source.sha256').read_text().strip()==receipt['source_snapshot_sha256'], 'SOURCE_RECEIPT_HASH')
    require(digest(a.artifact/'compiled.json')==receipt.get('compiled_receipt_sha256'), 'COMPILED_RECEIPT_HASH')
    docker('load','--input',str(a.artifact/'backend-image.tar.gz'))
    c = json.loads(docker('image','inspect','--format','{{json .}}',image))
    require(c['Id']==image and c['Os']=='linux' and c['Architecture']=='amd64', 'LOADED_CONFIG_ID')
    labels = c['Config'].get('Labels') or {}
    for key,value in [('org.opencontainers.image.revision',approval['base_commit']),('io.hobbysalon.source.archive.sha256',approval['archive_sha256']),('io.hobbysalon.source.manifest.sha256',approval['manifest_sha256'])]: require(labels.get(key)==value,'LOADED_SOURCE_LABEL')
    # Re-inspect actual image COPY bytes and compiled code using the parent's inspector.
    docker('tag',image,IMAGE)
    a.out.mkdir()
    subprocess.run([sys.executable,str(ROOT/'release-input/verify-image.py'),'--manifest',str(ROOT/'release-input/source.full.manifest.jsonl'),'--inspector',str(ROOT/'release-input/inspect-compiled.cjs'),'--out',str(a.out)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    observed = json.loads((a.out/'image-receipt.json').read_text())
    require(observed==receipt, 'ACTUAL_IMAGE_RECEIPT_MISMATCH')
    with Path(os.environ['GITHUB_ENV']).open('a') as f: f.write('CANDIDATE_ID='+image+'\n')
    print(json.dumps({'status':'PASS','image_id':image,'archive_sha256':declared[0],'source_snapshot_sha256':receipt['source_snapshot_sha256'],'scope':'exact image verification only; no runtime acceptance'}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--binding-only',action='store_true');p.add_argument('--artifact',type=Path);p.add_argument('--out',type=Path);a=p.parse_args()
    try:
        require(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted', 'HOSTED_ONLY')
        if a.binding_only: binding()
        else: verify(a)
    except Exception:
        print('FAIL: exact candidate verification refused; diagnostics withheld',file=sys.stderr)
        raise SystemExit(2)
