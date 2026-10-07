#!/usr/bin/env python3
"""No-launch regression tests. Fake package fixtures are NOT acceptance evidence."""
import argparse
import ast
import json
import os
from pathlib import Path
import runpy
import stat
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent

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
    # Syntax and explicit no-launch boundary check, without executing acceptance.
    source = (ROOT / 'acceptance.cjs').read_text()
    preflight = source.split("if(process.argv[2]==='--preflight'){")[1].split('}else if(')[0]
    assert 'observer.connect' not in preflight and 'c.run(' not in preflight and '.up(' not in preflight
    for file in ['acceptance.cjs', 'dependency-identity.cjs']:
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
    print(json.dumps({'status':'passed','scope':'no-launch diagnostics allowlist, syntax, private modes, exclusive/symlink refusal, helper hash coverage; NO PG evidence'}))

if __name__ == '__main__':
    main()
