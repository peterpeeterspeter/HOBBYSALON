#!/usr/bin/env python3
"""No-launch regression tests. Fake package fixtures are NOT acceptance evidence."""
import argparse
import ast
import io
import json
import os
from pathlib import Path
import runpy
import stat
import subprocess
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent

def transaction_context_regression():
    # Real Node assertions and AsyncLocalStorage; in-memory control adapters only.
    # Context lookup mirrors the inspected pinned MikroORM 6.4.16 methods. This
    # exercises the actual fixture callback, NOT candidate SQL or PG acceptance.
    code = r"""const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {AsyncLocalStorage}=require('node:async_hooks');
const source=fs.readFileSync(process.argv[1],'utf8');
const start=source.indexOf("test('physical_transaction_context_and_atomic_rollback',");
const end=source.indexOf("test('committed_parent_fixture_duplicate_no_reapply',",start);
assert(start>=0&&end>start);const fixture=source.slice(start,end);
class TransactionContext {
  static storage=new AsyncLocalStorage();
  static create(em,next){return this.storage.run({em},next)}
  static getEntityManager(name='default'){const context=this.storage.getStore();return context?.em.name===name?context.em:undefined}
}
class Manager {
  constructor(db='acceptance',useContext=true){this.db=db;this.useContext=useContext;this.name='default';this.transactionContext=undefined}
  getContext(validate=true){if(!this.useContext)return this;let em=TransactionContext.getEntityManager(this.name);if(em)return em;return this}
  getTransactionContext(){return this.getContext(false).transactionContext}
  fork(options={}){const em=options.disableContextResolution?this:this.getContext(false);return new Manager(em.db,options.useContext??false)}
  setTransactionContext(trx){this.transactionContext=trx}
}
async function run(text,control='healthy'){
  const state={admitted:false,receipt:false,sentinel:false,insert:false,foreign:false,intentional:false,emits:0};
  const root=new Manager(),manager=root.fork(),observer={processID:99};let callback;
  const sandbox={assert,mainOrm:{em:root},manager,observer,eventIdentity:()=>({}),
    test:(_name,fn)=>{callback=fn},admit:async()=>{state.admitted=true},committed:async()=>state.receipt,
    sql:async q=>q.includes('fixture_sentinel')?(state.sentinel?[{}]:[]):q.includes('marketplace_webhook_admission')?(state.admitted?[{}]:[]):[],
    ormFor:async db=>({em:new Manager(db),close:async()=>{}}),emit:()=>{state.emits++},
    apply:async(_manager,_input,work)=>{
      const owner=manager.fork({useContext:false});let completed=false,active=true;
      const trx={isTransaction:true,isCompleted:()=>completed};owner.setTransactionContext(trx);
      const check=()=>{if(!active)throw Error('authority expired')};
      const execute=async(q,local=false)=>{
        check();if(q.includes('pg_backend_pid'))return [{pid:local&&control==='wrong_pid'?8:7,txid:local&&control==='wrong_txid'?'2':'1'}];
        if(q.includes('INSERT INTO fixture_sentinel')){state.insert=true;if(control==='visible_write')state.sentinel=true;return []}
        throw Error('unexpected regression query');
      };
      const scope={execute:q=>execute(q),context:em=>{
        check();if(em.getContext().db!==owner.db){state.foreign=true;throw Error('database mismatch')}
        const local=em.fork({useContext:false});local.setTransactionContext(trx);local.execute=q=>execute(q,true);return {transactionManager:local}
      }};
      try{return await TransactionContext.create(owner,async()=>{
        if(control==='root_mutation')rootProbeMutation();
        try{return await work(scope)}catch(e){state.intentional=e.message==='intentional rollback';throw e}
      })}finally{
        active=control==='live_authority';completed=true;
        if(control==='leaked_receipt')state.receipt=true;
        if(control==='lost_admission')state.admitted=false;
      }
      function rootProbeMutation(){root.setTransactionContext(trx)}
    }};
  vm.runInNewContext(text,sandbox,{filename:'acceptance.cjs'});
  try{await callback()}catch(e){e.regressionState=state;throw e}return state;
}
(async()=>{
  const old=fixture.replace('assert.equal(mainOrm.em.getTransactionContext(),trx);assert.equal(rootProbe.getTransactionContext(),undefined)',
    'assert.equal(mainOrm.em.getTransactionContext(),undefined)');
  assert.notEqual(old,fixture);await assert.rejects(run(old),e=>e.code==='ERR_ASSERTION'&&e.operator==='rejects'&&!e.regressionState.insert&&!e.regressionState.intentional);
  const healthy=await run(fixture);assert(healthy.insert&&healthy.foreign&&healthy.intentional);assert.equal(healthy.emits,1);
  const resolvedForeign=fixture.replace('foreign.em.fork({clear:true,useContext:false,disableContextResolution:true})','foreign.em.fork({clear:true,useContext:false})');
  assert.notEqual(resolvedForeign,fixture);await assert.rejects(run(resolvedForeign),e=>e.code==='ERR_ASSERTION'&&!e.regressionState.foreign&&!e.regressionState.intentional);
  const ambientForeign=fixture.replace('foreign.em.fork({clear:true,useContext:false,disableContextResolution:true})','foreign.em');
  assert.notEqual(ambientForeign,fixture);await assert.rejects(run(ambientForeign),e=>e.code==='ERR_ASSERTION'&&!e.regressionState.foreign&&!e.regressionState.intentional);
  const controls=['wrong_pid','wrong_txid','visible_write','root_mutation','leaked_receipt','lost_admission','live_authority'];
  for(const control of controls)await assert.rejects(run(fixture,control),e=>e.code==='ERR_ASSERTION');
  console.log(JSON.stringify({status:'passed',scope:'actual rollback fixture callback; real Node AsyncLocalStorage; pinned-context semantics with in-memory controls; NO PG acceptance',old_failure_reproduced:true,foreign_ambient_mask_reproduced:true,negative_controls:controls.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
"""
    done = subprocess.run(['node', '-e', code, str(ROOT/'acceptance.cjs')],
                          capture_output=True, text=True, check=True, timeout=10)
    print(done.stdout.strip())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-root', type=Path, required=True)
    parser.add_argument('--private-dir', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    args.private_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    module = runpy.run_path(str(ROOT / 'run-postgres.py'))
    module['hashes'].__globals__['CANDIDATE'] = args.candidate_root.resolve()
    module['self_test']()
    transaction_context_regression()
    diagnostics = module['node_diagnostics']
    valid = 'PG_CHECKPOINT ' + json.dumps({'stage':'PG_DEPENDENCY_IDENTITIES','role':'main','sequence':1,'error':'private text'})
    valid += '\nPG_NODE_DIAGNOSTIC ' + json.dumps({'stage':'PG_DEPENDENCY_IDENTITIES','role':'main','code':'MODULE_NOT_FOUND','error':'private text'})
    safe = diagnostics(valid)
    assert len(safe['checkpoints']) == len(safe['failures']) == 1
    assert 'private text' not in json.dumps(safe)
    for item in [None, [], {'stage':{}}, {'stage':'SECRET','role':'main'},
                 {'stage':'PG_DEPENDENCY_IDENTITIES','role':'main','sequence':True},
                 {'stage':'PG_DEPENDENCY_IDENTITIES','role':'main','sequence':0},
                 {'stage':'PG_DEPENDENCY_IDENTITIES','role':'main','code':'secret'}]:
        for tag in ['PG_CHECKPOINT', 'PG_NODE_DIAGNOSTIC']:
            assert diagnostics(tag + ' ' + json.dumps(item)) == {'checkpoints':[], 'failures':[]}
    assert diagnostics('PG_CHECKPOINT {bad json') == {'checkpoints':[], 'failures':[]}
    # Real subprocess nonzero output + defensive throwing adapter + timeout capture.
    # These are regression controls, never PG acceptance receipts.
    capture, command_result = module['capture_node_result'], module['command_result']
    case = module['EXPECTED'][0]
    failed = {'name':case, 'status':'failed', 'code':'ERR_ASSERTION', 'operator':'strictEqual',
              'classification':'PRIVATE', 'stack':{'file':'acceptance.cjs','line':12,'raw':'PRIVATE'}, 'error':'PRIVATE'}
    output = 'TEST_RESULT ' + json.dumps(failed) + '\n' + valid + '\nRUNTIME_METADATA {bad json\n'
    for check in (False, True):
        report, log = {}, io.StringIO()
        try:
            done = command_result(log, ['python3','-c', 'import sys; print(sys.argv[1], flush=True); sys.exit(7)', output],
                                  check=check, on_result=lambda d,o: capture(report,d,o))
        except module['Blocked']:
            assert check
        else:
            assert not check and done.returncode == 7
        assert report['node_exit_code'] == 7 and len(report['failed_cases']) == 1
        assert report['failed_cases'][0]['classification'] == 'ASSERTION'
        assert report['node_diagnostics']['failures'][0]['code'] == 'MODULE_NOT_FOUND'
        assert report['node_diagnostic_stage'] == 'PG_DEPENDENCY_IDENTITIES'
        assert report['diagnostic_stage'] == 'PG_RECEIPT_CAPTURE'
        assert 'PRIVATE' not in json.dumps(report) and output in log.getvalue()
        try:
            module['validate'](output, report['node_exit_code'], {})
        except RuntimeError:
            pass
        else:
            raise AssertionError('nonzero failed control accepted')
    for check in (False, True):
        report, log = {}, io.StringIO()
        with patch('subprocess.run', side_effect=subprocess.CalledProcessError(7,['adapter'],output=output.encode())) as mocked:
            try:
                done = command_result(log,['adapter'],check=check,on_result=lambda d,o:capture(report,d,o))
            except module['Blocked']:
                assert check
            else:
                assert not check and done.returncode == 7
            assert mocked.call_args.kwargs['check'] is False
        assert report['node_command_outcome'] == 'CALLED_PROCESS_ERROR'
        assert report['failed_cases'][0]['stack'] == {'file':'acceptance.cjs','line':12}
        assert output in log.getvalue() and 'PRIVATE' not in json.dumps(report)
    report, log = {}, io.StringIO()
    try:
        command_result(log,['python3','-c','import sys,time; print(sys.argv[1],flush=True); time.sleep(5)',output],
                       timeout=1,check=False,on_result=lambda d,o:capture(report,d,o))
    except module['Blocked']:
        pass
    else:
        raise AssertionError('timeout accepted')
    assert report['node_exit_code'] is None and report['node_command_outcome'] == 'TIMEOUT'
    assert len(report['failed_cases']) == 1 and output in log.getvalue()
    assert 'PRIVATE' not in json.dumps(report)
    for item in [None, [], {'name':'PRIVATE','status':'failed'}, {'name':case,'status':'PRIVATE'}]:
        assert module['safe_test_results']('TEST_RESULT '+json.dumps(item)) == []
    for unsafe in [{'code':{}}, {'operator':'PRIVATE'}, {'stack':{'file':'PRIVATE','line':12}},
                   {'stack':{'file':'acceptance.cjs','line':True}}, {'stack':{'file':'acceptance.cjs','line':0}}]:
        safe = module['safe_test_results']('TEST_RESULT '+json.dumps({**failed, **unsafe}))[0]
        assert 'PRIVATE' not in json.dumps(safe)
    node_code = r"""const assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const helper=require(process.argv[1]), inventory=require(process.argv[2]);
assert.deepEqual(helper.CODE_CLASSES,JSON.parse(process.argv[3]));
assert.deepEqual([...helper.OPERATORS].sort(),JSON.parse(process.argv[4]).sort());
const file=path.join(path.dirname(process.argv[1]),'acceptance.cjs');
let error;try{vm.runInNewContext('assert.equal("PRIVATE actual", "PRIVATE expected")',{assert},{filename:file})}catch(e){error=e}
const result=helper.failedCase(inventory.cases[0],error);
assert.equal(result.code,'ERR_ASSERTION');assert.equal(result.operator,'strictEqual');
assert.deepEqual(result.stack,{file:'acceptance.cjs',line:1});assert(!JSON.stringify(result).includes('PRIVATE'));
assert.throws(()=>helper.failedCase('PRIVATE',error));
for(const code of Object.keys(helper.CODE_CLASSES))assert.equal(helper.failedCase(inventory.cases[0],{code}).classification,helper.CODE_CLASSES[code]);
const unsafe=helper.failedCase(inventory.cases[0],{code:'PRIVATE',operator:'PRIVATE',message:'PRIVATE',stack:'PRIVATE\n at /private/acceptance.cjs:13:2'});
assert.equal(unsafe.code,'UNCLASSIFIED');assert.equal(unsafe.operator,null);assert.equal(unsafe.stack,null);assert(!JSON.stringify(unsafe).includes('PRIVATE'));
console.log(JSON.stringify({status:'passed',scope:'real Node assertion extraction; no suite, DB or acceptance evidence',code:result.code,operator:result.operator,stack:result.stack}));
"""
    done = subprocess.run(['node','-e',node_code,str(ROOT/'failed-case-diagnostics.cjs'),str(ROOT/'inventory.json'),
                           json.dumps(module['CASE_CLASSES']),json.dumps(sorted(module['CASE_OPERATORS']))],
                          capture_output=True,text=True,check=True,timeout=10)
    print(done.stdout.strip())
    print(json.dumps({'status':'passed','scope':'real exit-7/check-true/check-false and partial-output timeout capture; throwing-adapter control; allowlist rejection; NO PG evidence'}))
    # Syntax and explicit no-launch boundary check, without executing acceptance.
    source = (ROOT / 'acceptance.cjs').read_text()
    preflight = source.split("if(process.argv[2]==='--preflight'){")[1].split('}else if(')[0]
    assert 'observer.connect' not in preflight and 'c.run(' not in preflight and '.up(' not in preflight
    for file in ['acceptance.cjs', 'dependency-identity.cjs', 'failed-case-diagnostics.cjs']:
        subprocess.run(['node', '--check', str(ROOT / file)], check=True, capture_output=True, text=True, timeout=10)
    with tempfile.TemporaryDirectory(prefix='pg-selftest-', dir=args.private_dir) as temp:
        temp = Path(temp)
        fixture = temp / 'node_modules/@medusajs/deps'
        (fixture / 'dist').mkdir(parents=True)
        manifest = {'name':'@medusajs/deps','version':'2.11.3','main':'dist/index.js',
                    'exports':{'.':'./dist/index.js','./mikro-orm/core':'./dist/mikro-orm-core.js'}}
        (fixture / 'package.json').write_text(json.dumps(manifest))
        (fixture / 'dist/mikro-orm-core.js').write_text('module.exports = {}\n')
        (temp / 'package.json').write_text('{}')
        code = """const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const helper=require(process.argv[1]), dep=createRequire(path.join(process.argv[2],'package.json'));
assert.throws(()=>dep.resolve('@medusajs/deps'),{code:'MODULE_NOT_FOUND'});
assert.equal(helper.specifier('@medusajs/deps'),'@medusajs/deps/mikro-orm/core');
assert.equal(helper.specifier('pg'),'pg');
const id=helper.identity(dep,'@medusajs/deps','2.11.3');
assert.equal(id.version,'2.11.3');assert(id.entry.endsWith('/dist/mikro-orm-core.js'));
for(const k of ['entry_sha256','package_sha256'])assert.match(id[k],/^[a-f0-9]{64}$/);
assert.throws(()=>helper.identity(dep,'@medusajs/deps','0.0.0'),{code:'ERR_ASSERTION'});
fs.appendFileSync(id.entry,'// modified');assert.notEqual(helper.identity(dep,'@medusajs/deps','2.11.3').entry_sha256,id.entry_sha256);
fs.unlinkSync(id.entry);assert.throws(()=>helper.identity(dep,'@medusajs/deps','2.11.3'));
assert.equal(helper.errorCode({code:'PRIVATE'}),'UNCLASSIFIED');
console.log(JSON.stringify({status:'passed',scope:'fake package regression only; no image or PG acceptance',controls:8}));
"""
        done = subprocess.run(['node','-e',code,str(ROOT/'dependency-identity.cjs'),str(temp)],
                              capture_output=True,text=True,check=True,timeout=10)
        print(done.stdout.strip())
        receipt = temp / 'receipt.log'
        with module['private_open'](receipt, exclusive=True) as log:
            log.write('private test fixture\n')
        assert stat.S_IMODE(receipt.stat().st_mode) == 0o600
        try:
            module['private_open'](receipt, exclusive=True)
        except FileExistsError:
            pass
        else:
            raise AssertionError('existing evidence overwritten')
        link = temp / 'symlink.log'
        link.symlink_to(receipt)
        try:
            module['private_open'](link)
        except OSError:
            pass
        else:
            raise AssertionError('symlink accepted')
        assert receipt.read_text() == 'private test fixture\n'
    ast.parse((ROOT/'run-postgres.py').read_text())
    assert 'harness/dependency-identity.cjs' in module['hashes']()
    assert 'harness/failed-case-diagnostics.cjs' in module['hashes']()
    print(json.dumps({'status':'passed','scope':'no-launch diagnostics allowlist, syntax, private modes, exclusive/symlink refusal, helper hash coverage; NO PG evidence'}))

if __name__ == '__main__':
    main()
