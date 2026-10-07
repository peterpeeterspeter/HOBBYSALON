#!/usr/bin/env python3
"""Authenticate the full package and workflow, before parsing/extracting source."""
import hashlib,json,re,subprocess,sys
from pathlib import Path

def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''): h.update(b)
 return h.hexdigest()
def verify(root):
 root=Path(root)
 policy=json.loads((root/'binding.json').read_text())
 if policy.get('status')!='FINALIZED_AFTER_PARENT_PASS': raise ValueError('Unfinalized draft')
 if digest(root/'source-attestation-public.pem')!=policy['public_key_sha256']: raise ValueError('Public key pin mismatch')
 attpath=root/'source-attestation.json'
 if attpath.stat().st_size>1000000: raise ValueError('Oversized attestation')
 result=subprocess.run(['openssl','pkeyutl','-verify','-rawin','-pubin','-inkey',str(root/'source-attestation-public.pem'),'-in',str(attpath),'-sigfile',str(root/'source-attestation.sig')],capture_output=True,timeout=30)
 if result.returncode: raise ValueError('Signature mismatch')
 att=json.loads(attpath.read_text())
 expected={p.name for p in root.iterdir() if p.is_file()}-{'source-attestation.json','source-attestation.sig'}
 if set(att['files'])!=expected: raise ValueError('Signed package file-set mismatch')
 for n,h in att['files'].items():
  if not re.fullmatch(r'[A-Za-z0-9_.-]+',n) or not re.fullmatch(r'[a-f0-9]{64}',h) or digest(root/n)!=h: raise ValueError('Signed file mismatch: '+str(n))
 if digest(root.parent/'.github/workflows/rollback-bridge-build.yml')!=att['workflow_sha256']: raise ValueError('Signed workflow mismatch')
 a=policy['approval']
 if json.loads((root/'approval.json').read_text())!=a: raise ValueError('Signed approval binding mismatch')
 if att['kind']!='rollback-bridge-build-source' or att['parent_seal_sha256']!=a['parent_seal_sha256']: raise ValueError('Attestation scope mismatch')
 return policy
if __name__=='__main__':
 try:
  verify(Path(sys.argv[1])); print(json.dumps({'status':'PASS','kind':'source-signature-verification','runtime_acceptance':False}))
 except Exception as e:
  print('FAIL: '+str(e),file=sys.stderr);sys.exit(2)
