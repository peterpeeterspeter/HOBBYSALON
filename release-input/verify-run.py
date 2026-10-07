#!/usr/bin/env python3
"""First creation push / first attempt only; no manual dispatch or rerun."""
import json,os,sys
BRANCH='ops/rollback-bridge-20261007'
def check(env,event):
 expected={'GITHUB_REPOSITORY':'peterpeeterspeter/HOBBYSALON','GITHUB_EVENT_NAME':'push','GITHUB_REF':'refs/heads/'+BRANCH,'GITHUB_RUN_ATTEMPT':'1'}
 if any(env.get(k)!=v for k,v in expected.items()): raise ValueError('Run scope/attempt mismatch')
 if any(event.get(k) is not v for k,v in [('created',True),('deleted',False),('forced',False)]): raise ValueError('Only first non-forced branch creation allowed')
 head=env.get('GITHUB_SHA','')
 if event.get('ref')!=expected['GITHUB_REF'] or event.get('after')!=head or len(head)!=40 or any(c not in '0123456789abcdef' for c in head): raise ValueError('Push HEAD binding mismatch')
if __name__=='__main__':
 try:
  check(os.environ,json.load(open(os.environ['GITHUB_EVENT_PATH']))); print('PASS: first creation, attempt 1')
 except Exception as e:
  print('FAIL: '+str(e),file=sys.stderr);sys.exit(2)
