#!/usr/bin/env python3
"""Allowlist-only public projection. Never copy errors, logs, env, paths or DB rows."""
import argparse, json, os, re
from pathlib import Path

WORKFLOW_STAGES={'CHECKOUT','SOURCE_APPROVAL','BUILD_BINDING','CANDIDATE_DOWNLOAD','CANDIDATE_VERIFY','PG_FIXTURE_PULL','PG_CONTROLS','PG_HARNESS','RUNTIME_CONTROLS','PREVIOUS_ACQUISITION','PREVIOUS_LOAD','RUNTIME_HARNESS','COMPLETE'}
HARNESS_STAGES={'PG_SOURCE_PINS','PG_RESOURCE_GUARD','PG_IMAGE_PINS','PG_FIXTURE_START','PG_NODE_START','PG_RECEIPT_VERIFY','PG_CLEANUP','RUNTIME_GUARD','RUNTIME_PREVIOUS_RECEIPT','RUNTIME_IMAGE_PINS','RUNTIME_FIXTURE_PULL','RUNTIME_ISOLATION','RUNTIME_FIXTURE_START','RUNTIME_EMPTY_FIXTURES','RUNTIME_MIGRATIONS','RUNTIME_INDEX_BOOTSTRAP','RUNTIME_ROLE_RESTRICTIONS','RUNTIME_PHYSICAL_FIXTURE','RUNTIME_BASELINE','RUNTIME_PHASE','RUNTIME_STARTUP_NEGATIVE','RUNTIME_CLEANUP','COMPLETE'}
PHASES={'candidate','candidate-restart','previous','previous-restart','candidate-restored','candidate-restored-restart','startup-negative'}

def project(data, kind, job_status, diagnostic_stage='UNKNOWN'):
    statuses={'PASS','FAIL','passed','failed','blocked','cleanup_failed','success','failure','cancelled','running'}
    result={'schema':1,'kind':kind,'scope':'disposable limited fixtures only; NOT full-native commerce, provider or production acceptance','job_status':job_status if job_status in statuses else 'unknown','status':data.get('status') if data.get('status') in statuses else 'NOT_RUN','deployment':False,'provider_acceptance':False,'full_native_commerce_acceptance':False}
    for key in ('cleanup','db_credentials_revoked','ephemeral_tmpfs_removed','runtime_role_restricted','empty_pg','empty_redis'):
        # All diagnostics come from fixed codes, never report errors or raw logs.
        if type(data.get(key)) is bool: result[key]=data[key]
    result['diagnostic_stage']=diagnostic_stage if isinstance(diagnostic_stage,str) and diagnostic_stage in WORKFLOW_STAGES else 'UNKNOWN'
    stage=data.get('diagnostic_stage')
    if isinstance(stage,str) and stage in HARNESS_STAGES: result['harness_stage']=stage
    phase=data.get('diagnostic_phase')
    if isinstance(phase,str) and phase in PHASES: result['diagnostic_phase']=phase
    # Import only the fixed diagnostic allowlists, never raw command evidence.
    import runpy
    root = Path(__file__).resolve().parent
    if kind=='runtime':
        runtime = runpy.run_path(str(root/'runtime/runtime.py'))
        codes = data.get('diagnostic_codes', [])
        result['diagnostic_codes'] = [x for x in codes if isinstance(x,str) and x in runtime['DIAGNOSTIC_CODES']] if isinstance(codes,list) else []
    if kind=='postgres':
        pg = runpy.run_path(str(root/'database/run-postgres.py'))
        stage = data.get('node_diagnostic_stage')
        if isinstance(stage,str) and stage in pg['NODE_STAGES']: result['node_diagnostic_stage'] = stage
        diagnostics = data.get('node_diagnostics', {})
        failures = diagnostics.get('failures', []) if isinstance(diagnostics,dict) else []
        result['node_failure_codes'] = [x['code'] for x in failures if isinstance(x,dict) and isinstance(x.get('code'),str) and x['code'] in pg['NODE_CODES']] if isinstance(failures,list) else []
        result['planned_tests'] = len(pg['EXPECTED'])
        failed = data.get('failed_cases', [])
        result['failed_cases'] = [row for row in pg['safe_test_results']('\n'.join('TEST_RESULT '+json.dumps(x) for x in failed)) if row['status']=='failed'] if isinstance(failed,list) else []
        results=data.get('results',[])
        result['observed_tests']=len(results) if isinstance(results,list) else 0
        result['passed_tests']=sum(isinstance(x,dict) and x.get('status')=='passed' for x in results) if isinstance(results,list) else 0
        if type(data.get('exit_code')) is int: result['exit_code']=data['exit_code']
        cleanup=data.get('cleanup',[])
        result['cleanup_verified']=isinstance(cleanup,list) and bool(cleanup) and all(isinstance(x,dict) and (x.get('removed_and_verified') is True or x.get('absent') is True) for x in cleanup)
    phases=[]
    source_phases=data.get('phases',[])
    for phase in source_phases if isinstance(source_phases,list) else []:
        if not isinstance(phase,dict): continue
        row={}
        if phase.get('phase') in {'candidate','candidate-restart','previous','previous-restart','candidate-restored','candidate-restored-restart'}: row['phase']=phase['phase']
        for key in ('image','all_public_tables_sha256','schema_sha256','static_sha256'):
            value=phase.get(key)
            if isinstance(value,str) and re.fullmatch(r'(?:sha256:)?[a-f0-9]{64}',value): row[key]=value
        if phase.get('native_continuous_healthy_seconds')==300: row['native_continuous_healthy_seconds']=300
        phases.append(row)
    if kind=='runtime': result['phases']=phases
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--kind',choices=['postgres','runtime'],required=True);p.add_argument('--report',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    data={}
    if a.report.exists():
        try:
            if not a.report.is_symlink() and a.report.stat().st_size<=8*1024*1024: data=json.loads(a.report.read_text())
            if not isinstance(data,dict): data={}
        except Exception: data={}
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(project(data,a.kind,os.environ.get('JOB_STATUS','unknown'),os.environ.get('DIAGNOSTIC_STAGE','UNKNOWN')),indent=2)+'\n')