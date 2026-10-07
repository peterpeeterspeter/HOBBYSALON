#!/usr/bin/env python3
"""Offline binder after parent-approved single successful bridge build, never guesses pins.
Parent supplies independently reviewed pins and provider metadata; output is BUILD_ONLY.
Fresh output directory only. Reads actual build artifact ZIP plus exported source tar/manifest.
"""
import argparse,hashlib,importlib.util,json,os,sys,tarfile,zipfile
from pathlib import Path
s=importlib.util.spec_from_file_location('bridge_contract',Path(__file__).with_name('bridge-contract.py'));c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
def h(path):
    value=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):value.update(b)
    return value.hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    for k in ['parent-pins','artifact-metadata','run-metadata','branch-metadata','main-before','main-after','artifact-zip','source-archive','source-manifest','source-package','out']:p.add_argument('--'+k,type=Path,required=True)
    a=p.parse_args();pins=json.loads(a.parent_pins.read_text());contract=dict(c.SPEC,status='BOUND_BUILD_ONLY',binding=dict(pins,parent_pins_sha256=h(a.parent_pins)))
    b=c.validate(contract)
    signature=c.authenticate_source(a.source_package,b)
    c.need(a.source_manifest.resolve()==(a.source_package/'source.full.manifest.jsonl').resolve() and a.source_archive.resolve()==(a.source_package/'source.full.tar.xz').resolve(),'BRIDGE_ACTUAL_GENERATED_SOURCE_PACKAGE_REQUIRED')
    read=lambda p:json.loads(p.read_text())
    before=c.metadata(contract,read(a.artifact_metadata),read(a.run_metadata),read(a.branch_metadata),read(a.main_before))
    after=c.metadata(contract,read(a.artifact_metadata),read(a.run_metadata),read(a.branch_metadata),read(a.main_after));c.need(before==after,'BRIDGE_MAIN_CHANGED')
    c.need(a.artifact_zip.stat().st_size==b['zip_bytes'] and h(a.artifact_zip)==b['zip_sha256'],'BRIDGE_ZIP_PARENT_PIN')
    c.need(h(a.source_archive)==b['source_archive_sha256'] and h(a.source_manifest)==b['source_manifest_sha256'],'BRIDGE_ACTUAL_BUILD_SOURCE_EXPORT_REQUIRED')
    manifest=a.source_manifest.read_bytes();records=[json.loads(x) for x in manifest.splitlines()];c.need(len(records)==3892,'BRIDGE_EXACT_SOURCE_FILE_COUNT')
    expected=c.manifest_map(manifest);c.need(expected==c.copy_review()['source_files'],'BRIDGE_REVIEWED_SOURCE_EXPORT_REQUIRED')
    with tarfile.open(a.source_archive,'r:*') as source:
        members=source.getmembers();actual={}
        c.need(len(members)<=20000,'BRIDGE_SOURCE_ARCHIVE_BOUND')
        for m in members:
            name=m.name.removeprefix('./');c.need(not name.startswith('/') and '..' not in name.split('/'),'BRIDGE_SOURCE_EXPORT_PATH')
            if m.isdir():continue
            c.need(m.isfile() and m.size<=64*1024*1024 and name not in actual,'BRIDGE_SOURCE_EXPORT_ENTRY')
            actual[name]=hashlib.sha256(source.extractfile(m).read()).hexdigest()
    c.need(actual==expected,'BRIDGE_SOURCE_EXPORT_BYTES_MISMATCH')
    c.need(not any('reconciliation' in n.lower() and '/migrations/' in n for n in expected),'BRIDGE_MUST_NOT_ADD_AUDIT_MIGRATION')
    c.need(not a.out.exists() and a.out.parent.is_dir(),'BRIDGE_FRESH_BINDING_OUTPUT');a.out.mkdir(mode=0o700)
    engine=c.engine(b);archive=engine.extract_pinned(a.artifact_zip,a.out);m=engine.inspect_image(archive)
    with zipfile.ZipFile(a.artifact_zip) as z:
        receipt=z.read('image-receipt.json');source=z.read('baked/source.json');compiled=z.read('compiled.json')
    c.need(hashlib.sha256(receipt).hexdigest()==b['build_receipt_sha256'],'BRIDGE_ACTUAL_BUILD_RECEIPT_REQUIRED')
    r=json.loads(receipt)
    for key,pin in [('source_base_commit','source_base_commit'),('archive_sha256','source_archive_sha256'),('manifest_sha256','source_manifest_sha256')]:c.need(r.get(key)==b[pin],'BRIDGE_RECEIPT_SOURCE_EXPORT_BINDING')
    checks=c.image_source_bytes(archive,b,manifest,source,receipt,compiled);c.need(m['diff_ids']==b['diff_ids'],'BRIDGE_LAYER_PARENT_PIN')
    engine.write_json(a.out/'bridge-contract.bound.json',contract)
    # Source export stays private and is copied only after exact artifact/image verification.
    (a.out/'source.full.manifest.jsonl').write_bytes(manifest)
    engine.write_json(a.out/'binding-verification.json',{'status':'BOUND_BUILD_ONLY','actual_build_receipt_verified':True,**signature,**checks,'runtime_acceptance':False,'deployment':False})
    print('BOUND_BUILD_ONLY: no real gate acceptance')
if __name__=='__main__':
    try:main()
    except Exception as e:
        print('BLOCKED: '+(str(e) if isinstance(e,c.Blocked) else 'BRIDGE_BINDING_EXCEPTION_REDACTED'));sys.exit(2)
