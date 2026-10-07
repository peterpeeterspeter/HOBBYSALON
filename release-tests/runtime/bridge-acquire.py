#!/usr/bin/env python3
"""Future hosted-only, separately acquired bridge. Pending contract refuses before any I/O."""
import argparse, hashlib, json, os, sys, time
from pathlib import Path
import importlib.util
s=importlib.util.spec_from_file_location('bridge_contract',Path(__file__).with_name('bridge-contract.py'));c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
def observe(a,contract,token):
    b=c.validate(contract)
    return c.metadata(contract,a.api_json(f'/actions/artifacts/{b["artifact_id"]}',token),a.api_json(f'/actions/runs/{b["run_id"]}',token),a.api_json('/git/ref/heads/'+contract['branch'],token),a.api_json('/git/ref/heads/main',token))
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--contract',type=Path,required=True);p.add_argument('--workdir',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--receipt',type=Path,required=True);p.add_argument('--source-export',type=Path,required=True);args=p.parse_args()
    contract=json.loads(args.contract.read_text());b=c.validate(contract);b=dict(b,contract_sha256=hashlib.sha256(args.contract.read_bytes()).hexdigest());a=c.engine(b)
    c.need(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted','BRIDGE_HOSTED_ONLY')
    os.umask(0o077);a.DEADLINE=time.monotonic()+180;token=os.environ.pop('GH_TOKEN','');c.need(bool(token),'BRIDGE_SCOPED_TOKEN')
    c.need(args.workdir.parent.is_dir() and not args.workdir.exists() and not args.workdir.is_symlink(),'BRIDGE_FRESH_WORKDIR');args.workdir.mkdir(mode=0o700)
    before=observe(a,contract,token);zip_path=args.workdir/'artifact.zip';a.download(token,zip_path);archive=a.extract_pinned(zip_path,args.workdir);m=a.inspect_image(archive)
    import zipfile
    with zipfile.ZipFile(zip_path) as z:
        source=z.read('baked/source.json');receipt=z.read('image-receipt.json');compiled=z.read('compiled.json')
    c.need(hashlib.sha256(receipt).hexdigest()==b['build_receipt_sha256'],'BRIDGE_BUILD_RECEIPT_HASH')
    export=args.source_export
    signature=c.authenticate_source(export,b)
    manifest=(export/'source.full.manifest.jsonl').read_bytes()
    c.need(hashlib.sha256(manifest).hexdigest()==b['source_manifest_sha256'],'BRIDGE_SOURCE_EXPORT_MANIFEST_HASH')
    m.update(c.image_source_bytes(archive,b,manifest,source,receipt,compiled),**signature,source_receipt_verified=True,identity_kind='distinct-rollback-bridge',contract_sha256=b['contract_sha256'])
    c.need(m['diff_ids']==b['diff_ids'],'BRIDGE_ORDERED_PINNED_LAYERS')
    after=observe(a,contract,token);c.need(before==after,'BRIDGE_API_IDENTITY_OR_MAIN_CHANGED');zip_path.unlink()
    a.write_json(args.manifest,m);a.write_json(args.receipt,{'status':'PASS','scope':'bridge-acquisition-only','before':before,'after':after,'main_unchanged_between_observations':True,**m,'runtime_acceptance':False,'deployment':False})
    print(json.dumps({'status':'PASS','scope':'bridge-acquisition-only','runtime_acceptance':False}))
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(json.dumps({'status':'FAIL','reason':str(e) if isinstance(e,(c.Blocked,)) else 'BRIDGE_ACQUISITION_EXCEPTION_REDACTED','runtime_acceptance':False}));sys.exit(2)
