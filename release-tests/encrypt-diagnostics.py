#!/usr/bin/env python3
"""Explicitly authorized encrypted disposable diagnostics; never publish plaintext."""
import argparse, io, json, os, stat, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
MAX_TOTAL=64*1024*1024
# Match the final diagnostic archive consumer's uncompressed per-member ceiling.
MAX_MEMBER=20_000_000

def bundle(kind, workspace, temp):
    bases = [('postgres', workspace/'release-tests/database/evidence')] if kind=='postgres' else [('runtime',temp/'scoped-tests/runtime'),('runtime-diagnosis',temp/'scoped-tests/runtime-diagnosis')]
    sources=[(label,base,True) for label,base in bases]
    if kind=='runtime':
        # Exact actual runner outputs only: do not recurse over scoped-tests,
        # dump environment/auth, copy downloaded images, or synthesize receipts.
        sources += [('runtime-control',temp/'scoped-tests/previous-manifest.json',False),
                    ('runtime-control',temp/'scoped-tests/acquisition.private.json',False),
                    ('candidate-verified',temp/'scoped-tests/verified/image-receipt.json',False)]
    data=io.BytesIO(); total=0; count=0
    with tarfile.open(fileobj=data,mode='w:gz') as archive:
        for label,base,recursive in sources:
            if any(x.is_symlink() for x in (base,*base.parents)): raise RuntimeError('DIAGNOSTIC_SYMLINK_REFUSED')
            if not base.exists(): continue
            if not recursive and not base.is_file(): raise RuntimeError('DIAGNOSTIC_FILE_REFUSED')
            for path in sorted(base.rglob('*')) if recursive else [base]:
                if path.is_symlink(): raise RuntimeError('DIAGNOSTIC_SYMLINK_REFUSED')
                if not path.is_file(): continue
                if path.suffix not in ('.json','.log'): continue
                relative=path.relative_to(base) if recursive else Path(path.name)
                if any(part in ('.','..') for part in relative.parts): raise RuntimeError('DIAGNOSTIC_PATH_REFUSED')
                size=path.stat().st_size
                if size>MAX_MEMBER: raise RuntimeError('DIAGNOSTIC_SIZE_LIMIT')
                total+=size
                if total>MAX_TOTAL: raise RuntimeError('DIAGNOSTIC_SIZE_LIMIT')
                content=path.read_bytes()
                if len(content)!=size: raise RuntimeError('DIAGNOSTIC_CHANGED')
                info=tarfile.TarInfo(label+'/'+relative.as_posix());info.size=size;info.mode=0o600
                archive.addfile(info,io.BytesIO(content));count+=1
        metadata=json.dumps({'schema':1,'kind':kind,'files':count,'bytes':total,'scope':'encrypted disposable tests only; not production'},sort_keys=True).encode()
        info=tarfile.TarInfo('metadata.json');info.size=len(metadata);info.mode=0o600
        archive.addfile(info,io.BytesIO(metadata))
    return data.getvalue(),count

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--kind',choices=['postgres','runtime'],required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    if os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('RUNNER_ENVIRONMENT')!='github-hosted' or os.environ.get('GITHUB_REPOSITORY')!='peterpeeterspeter/HOBBYSALON' or os.environ.get('GITHUB_REF')!='refs/heads/ops/release-validation-20261007': raise RuntimeError('SCOPED_HOSTED_ONLY')
    os.umask(0o077)
    payload,count=bundle(args.kind,Path(os.environ['GITHUB_WORKSPACE']),Path(os.environ['RUNNER_TEMP']))
    if args.out.exists() or args.out.is_symlink(): raise RuntimeError('ENCRYPTED_OUTPUT_EXISTS')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    pending=args.out.with_suffix('.pending')
    if pending.exists() or pending.is_symlink(): raise RuntimeError('ENCRYPTED_OUTPUT_EXISTS')
    try:
        proc=subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-gcm','-outform','DER','-out',str(pending),str(ROOT/'diagnostic-public-cert.pem')],input=payload,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
        if proc.returncode or not pending.is_file(): raise RuntimeError('DIAGNOSTIC_ENCRYPTION_FAILED')
        pending.chmod(0o600);pending.rename(args.out)
    except BaseException:
        pending.unlink(missing_ok=True)
        raise RuntimeError('DIAGNOSTIC_ENCRYPTION_FAILED') from None
    print(json.dumps({'status':'encrypted','kind':args.kind,'files':count,'private_key_uploaded':False}))
if __name__=='__main__':main()
