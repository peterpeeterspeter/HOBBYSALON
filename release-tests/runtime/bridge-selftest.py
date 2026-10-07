#!/usr/bin/env python3
"""Offline negative controls. Test vectors below are mocks, never real receipt hashes."""
import ast,copy,hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('bridge_contract_test',ROOT/'bridge-contract.py');c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
def fixture():
    b={'artifact_id':1,'run_id':2,'zip_bytes':3,'gzip_bytes':4,'image':'sha256:'+'a'*64,'commit':'b'*40,'parent_commit':'c'*40,'source_base_commit':'d'*40,'workflow_path':'.github/workflows/rollback-bridge-build.yml','diff_ids':['sha256:'+'e'*64]}
    for k in ['zip_sha256','gzip_sha256','source_hash','source_archive_sha256','source_manifest_sha256','build_receipt_sha256','parent_pins_sha256']:b[k]='f'*64
    for k in ['source_attestation_sha256','source_signature_sha256','source_public_key_sha256','source_workflow_sha256','source_approval_sha256']:b[k]='f'*64
    return dict(copy.deepcopy(c.SPEC),status='BOUND_BUILD_ONLY',binding=b)
class Tests(unittest.TestCase):
    def test_pending_no_default_original(self):
        with self.assertRaisesRegex(c.Blocked,'PENDING'):c.validate(c.SPEC)
    def test_wrong_bridge_config_and_candidate_rejected(self):
        for image in [c.SPEC['historical_previous']['image'],c.SPEC['candidate']['image'],'tag:latest',None]:
            x=fixture();x['binding']['image']=image
            with self.assertRaises(c.Blocked):c.validate(x)
    def test_unknown_previous_receipt_rejected(self):
        b=dict(c.validate(fixture()),contract_sha256='1'*64)
        with self.assertRaises(c.Blocked):c.verify_manifest({'image':c.SPEC['historical_previous']['image']},b)
    def test_source_candidate_unchanged(self):
        x=fixture();x['candidate']['commit']='1'*40
        with self.assertRaises(c.Blocked):c.validate(x)
        x=fixture();x['binding']['commit']=c.SPEC['candidate']['commit']
        with self.assertRaises(c.Blocked):c.validate(x)
    def test_metadata_branch_attempt_main(self):
        x=fixture();b=x['binding'];a={'id':1,'name':x['artifact_name'],'size_in_bytes':3,'expired':False,'digest':'sha256:'+b['zip_sha256'],'workflow_run':{'id':2,'head_sha':b['commit'],'head_branch':x['branch']}}
        r={'id':2,'head_sha':b['commit'],'head_branch':x['branch'],'event':'push','run_attempt':1,'status':'completed','conclusion':'success','path':b['workflow_path'],'repository':{'full_name':x['repository']}}
        branch={'ref':x['ref'],'object':{'sha':b['commit']}};main={'ref':'refs/heads/main','object':{'sha':'2'*40}}
        c.metadata(x,a,r,branch,main)
        for obj,key,value in [(a,'digest','sha256:'+'0'*64),(a,'name','wrong'),(r,'run_attempt',2),(r,'head_branch','main'),(r,'conclusion','failure'),(branch,'ref','refs/heads/main')]:
            variants=[copy.deepcopy(z) for z in [a,r,branch,main]];variants[[a,r,branch,main].index(obj)][key]=value
            with self.assertRaises(c.Blocked):c.metadata(x,*variants)
    def test_immutable_engine_fresh_not_historical_mutation(self):
        b=c.validate(fixture());engine=c.engine(b)
        self.assertEqual(engine.IMAGE,b['image']);self.assertEqual(engine.SOURCE,b['source_hash'])
        old=c.module('historical_test','acquire.py');self.assertEqual(old.IMAGE,c.SPEC['historical_previous']['image'])
    def test_wrong_gzip_or_layers_receipt(self):
        b=dict(c.validate(fixture()),contract_sha256='1'*64)
        m={'image':b['image'],'image_id':b['image'],'source_hash':b['source_hash'],'gzip_sha256':b['gzip_sha256'],'gzip_bytes':b['gzip_bytes'],'diff_ids':b['diff_ids'],'identity_kind':'distinct-rollback-bridge','contract_sha256':b['contract_sha256']}
        for k in ['config_sha256_verified','ordered_layer_sha256_verified','source_receipt_verified','source_export_verified','image_source_bytes_verified','image_source_labels_verified','actual_copy_pathset_verified','build_receipt_source_verified','source_signature_verified']:m[k]=True
        c.verify_manifest(m,b)
        for k,v in [('gzip_sha256','0'*64),('image','sha256:'+'0'*64),('diff_ids',['sha256:'+'0'*64]),('source_hash','0'*64),('source_receipt_verified',False)]:
            wrong=dict(m,**{k:v})
            with self.assertRaises(c.Blocked):c.verify_manifest(wrong,b)
    def test_runtime_bridge_readonly_native_original_preserved(self):
        text=(ROOT/'runtime.py').read_text()
        self.assertIn("self.previous_kind='readonly'",text);self.assertIn("getattr(self,'previous_kind','native')",text)
        self.assertIn("p.add_argument('--bridge-contract',type=Path,required=True)",text)
    def test_no_provision_finance_or_candidate_drift(self):
        d=ROOT.parents[1];baseline=json.loads((d/'release-tests/baseline-files.json').read_text())
        for rel in baseline:
            if rel.startswith('release-input/') or rel in ['release-tests/verify-candidate.py','release-tests/runtime/fixture.cjs','release-tests/runtime/init-observer.cjs','release-tests/runtime/index-diagnostics.cjs','release-tests/runtime/egress-deny.cjs'] or rel.startswith('release-tests/database/'):
                self.assertEqual(hashlib.sha256((d/rel).read_bytes()).hexdigest(),baseline[rel],rel)
        text=(ROOT/'runtime.py').read_text()
        for fragment in ['290*10**9','time.monotonic()-good>=300','password authentication failed','self.revoke_db_credentials()','owned_resources_unverified','public.count_estimate(text)','FIRSTBOOT_INVENTORY']:
            self.assertIn(fragment,text)
class WhiteoutTests(unittest.TestCase):
    """Real streaming tar reader; synthetic bytes only, no image acceptance."""
    def check_layers(self,markers,reverse=False,repeat_source=False,omit_source=()):
        import gzip,io,tarfile
        from unittest.mock import patch
        digest=lambda data:hashlib.sha256(data).hexdigest()
        def tar(rows):
            buf=io.BytesIO()
            with tarfile.open(fileobj=buf,mode='w') as archive:
                for name,data,kind in rows:
                    member=tarfile.TarInfo(name);member.type=kind
                    if kind in (tarfile.SYMTYPE,tarfile.LNKTYPE):member.linkname='unrelated'
                    member.size=len(data) if kind==tarfile.REGTYPE else 0
                    archive.addfile(member,io.BytesIO(data) if member.isfile() else None)
            return buf.getvalue()
        runtime={p:('synthetic:'+p).encode() for p in c.copy_review()['runtime_source_files']}
        review={'runtime_source_files':{p:digest(data) for p,data in runtime.items()},
            'source_files':{'apps/backend/entrypoint.sh':digest(b'synthetic-entrypoint')}}
        source=b'{"schema":2,"files":[]}'
        files={'app/'+p:data for p,data in runtime.items()}
        files.update({'usr/local/bin/release-entrypoint':b'synthetic-entrypoint',
            'release/source.json':source,'release/source.sha256':(digest(source)+'\n').encode()})
        b={'source_hash':digest(source),'source_base_commit':'synthetic-base','source_archive_sha256':'synthetic-archive',
            'source_manifest_sha256':'synthetic-manifest','commit':'synthetic-publication'}
        labels={'org.opencontainers.image.revision':b['source_base_commit'],
            'io.hobbysalon.source.archive.sha256':b['source_archive_sha256'],
            'io.hobbysalon.source.manifest.sha256':b['source_manifest_sha256'],
            'io.hobbysalon.bridge.publication.commit':b['commit'],'io.hobbysalon.bridge.branch':c.SPEC['branch']}
        config=json.dumps({'config':{'Labels':labels}}).encode();b['image']='sha256:'+digest(config)
        for path in omit_source:files.pop(path)
        lower=tar([(p,data,tarfile.REGTYPE) for p,data in files.items()])
        upper=tar([(p,b'',kind) for p,kind in markers]+([(p,data,tarfile.REGTYPE) for p,data in files.items()] if repeat_source else []))
        layers=[lower,upper];b['diff_ids']=['sha256:'+digest(layer) for layer in layers]
        blobs=[('blobs/sha256/'+digest(config),config,tarfile.REGTYPE)]+[('blobs/sha256/'+digest(layer),layer,tarfile.REGTYPE) for layer in (layers[::-1] if reverse else layers)]
        with tempfile.TemporaryDirectory() as tmp:
            archive=Path(tmp)/'synthetic.tar.gz';archive.write_bytes(gzip.compress(tar(blobs)))
            with patch.object(c,'copy_review',return_value=review),patch.object(c,'verify_copy_receipt',return_value=None):
                return c.image_source_bytes(archive,b,b'',source)
    def paths(self):
        return ['app/'+p for p in c.copy_review()['runtime_source_files']]+['usr/local/bin/release-entrypoint','release/source.json','release/source.sha256']
    def test_higher_root_app_whiteout_rejected_streaming(self):
        import tarfile
        with self.assertRaisesRegex(c.Blocked,'WHITEOUT'):self.check_layers([('.wh.app',tarfile.REGTYPE)])
    def test_every_required_path_and_segment_ancestor_whiteout_rejected(self):
        import tarfile
        markers=set()
        for path in self.paths():
            parts=path.split('/')
            for index,part in enumerate(parts):markers.add('/'.join(parts[:index]+['.wh.'+part]))
        for marker in sorted(markers):
            with self.subTest(marker=marker),self.assertRaisesRegex(c.Blocked,'WHITEOUT'):
                self.check_layers([(marker,tarfile.REGTYPE)])
    def test_opaque_root_and_every_required_directory_ancestor_rejected(self):
        import tarfile
        markers={'.wh..wh..opq'}
        for path in self.paths():
            parts=path.split('/')
            markers.update('/'.join(parts[:index]+['.wh..wh..opq']) for index in range(1,len(parts)))
        for marker in sorted(markers):
            with self.subTest(marker=marker),self.assertRaisesRegex(c.Blocked,'WHITEOUT'):
                self.check_layers([(marker,tarfile.REGTYPE)])
    def test_whiteout_any_layer_order_and_replacement_source_still_rejected(self):
        import tarfile
        for reverse in (False,True):
            for repeat in (False,True):
                with self.subTest(reverse=reverse,repeat=repeat),self.assertRaisesRegex(c.Blocked,'WHITEOUT'):
                    self.check_layers([('./.wh.app',tarfile.REGTYPE)],reverse,repeat)
    def test_unrelated_whiteouts_and_directories_do_not_match_path_prefixes(self):
        import tarfile
        markers=[('.wh.application',tarfile.REGTYPE),('usr/.wh.locality',tarfile.REGTYPE),
            ('app/unrelated/.wh..wh..opq',tarfile.REGTYPE),('release/.wh.unrelated',tarfile.REGTYPE),('app',tarfile.DIRTYPE)]
        self.assertTrue(self.check_layers(markers)['image_source_bytes_verified'])
    def test_file_and_link_replacements_of_protected_ancestors_rejected(self):
        import tarfile
        for path in ['app','app/deploy','release','usr','usr/local','usr/local/bin']:
            for kind in (tarfile.REGTYPE,tarfile.SYMTYPE,tarfile.LNKTYPE):
                with self.subTest(path=path,kind=kind),self.assertRaisesRegex(c.Blocked,'ANCESTOR'):
                    self.check_layers([(path,kind)])


def installer_source_contract_witness():
    """Pure helpers on 1312 hash-verified paths from the signed public archive.
    Authenticator verifies signed hashes without reading the archive; this offline
    regression separately reads it to reproduce installer COPY selection.
    No install, archive(), build, image binding, database or app execution.
    Historical repair-verify.py incorrectly used workspaces(full source tree).
    """
    import os, subprocess, tarfile
    package = ROOT / 'bridge-source-export'
    binding = c.load(ROOT / 'bridge-contract.bound.json')
    c.authenticate_source(package, binding)
    review = c.copy_review()
    manifest = c.manifest_map((package / 'source.full.manifest.jsonl').read_bytes())
    if len(manifest) != 3892 or manifest != review['source_files']:
        raise AssertionError('Signed source manifest must equal reviewed source path/hash set')
    actual = review['copy_files']
    if len(actual) != 1312 or any(manifest.get(rel) != digest for rel, digest in actual.items()):
        raise AssertionError('Reviewed COPY paths must match actual signed source hashes')
    archive = package / 'source.full.tar.xz'
    if archive.is_symlink() or hashlib.sha256(archive.read_bytes()).hexdigest() != binding['source_archive_sha256']:
        raise AssertionError('Actual signed source archive differs')
    with tempfile.TemporaryDirectory(prefix='scope-regression-') as temp:
        installer = Path(temp)
        observed_members = set()
        with tarfile.open(archive, mode='r|xz') as source:
            for member in source:
                rel = member.name
                if rel not in actual:
                    continue
                if rel in observed_members or not member.isfile() or member.issym() or member.islnk() or member.size > 64*1024*1024:
                    raise AssertionError('Unsafe or duplicate COPY source member: ' + rel)
                observed_members.add(rel)
                source_member = source.extractfile(member)
                if source_member is None:
                    raise AssertionError('COPY source member has no file bytes: ' + rel)
                data = source_member.read(64*1024*1024+1)
                if len(data) != member.size or hashlib.sha256(data).hexdigest() != actual[rel]:
                    raise AssertionError('Actual COPY source bytes differ: ' + rel)
                target = installer / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        if observed_members != set(actual):
            raise AssertionError('Signed archive must contain every reviewed COPY path')
        helper = installer / 'deploy/release/audit-dependencies.cjs'
        result = subprocess.run(['node', '-e',
            'const h=require(process.argv[1]);const r=process.argv[2];console.log(JSON.stringify({snapshot:h.snapshot(r),workspaces:h.workspaces(r).map(x=>x[0])}));',
            str(helper), str(installer)], capture_output=True, text=True, timeout=30,
            env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        witness = json.loads(result.stdout)
        observed = {row['path']: row['sha256'] for row in witness['snapshot']['files']}
        if observed != actual or len(observed) != len(witness['snapshot']['files']):
            raise AssertionError('Pure snapshot helper did not reproduce actual installer COPY scope')
        workspace = witness['workspaces']
        required = {'package.json', 'yarn.lock', *workspace,
            *[p for p in observed if p.startswith('deploy/release/') and p.count('/') == 2 and p.endswith('.cjs')]}
        return {'workspaces': workspace, 'installer_paths': sorted(observed),
            'runtime_source_files': {p: observed[p] for p in sorted(required)}}

class InstallerSourceContractTests(unittest.TestCase):
    """Exact source contract regression; synthetic image reader inputs only."""
    @classmethod
    def setUpClass(cls):
        cls.witness = installer_source_contract_witness()

    def test_backend_selected_manifest_derivation_is_exact(self):
        review = c.copy_review()
        self.assertEqual(len(review['source_files']), 3892)
        self.assertEqual(len(review['copy_files']), 1312)
        self.assertEqual(len(self.witness['runtime_source_files']), 18)
        self.assertEqual(review['runtime_source_files'], self.witness['runtime_source_files'])
        self.assertEqual(set(self.witness['workspaces']),
            {p for p in review['copy_files'] if p.endswith('/package.json')
             and (p.startswith('apps/') and p.count('/') == 2
                  or p.startswith('packages/') and p.count('/') == 2
                  or p.startswith('packages/modules/') and p.count('/') == 3)})

    def test_frontends_absent_from_installer_not_required_by_runtime(self):
        review = c.copy_review()
        self.assertEqual([p for p in self.witness['workspaces'] if p.startswith('apps/')],
            ['apps/backend/package.json'])
        for rel in ['apps/storefront/package.json', 'apps/vendor-panel/package.json']:
            self.assertIn(rel, review['source_files'])
            self.assertNotIn(rel, self.witness['installer_paths'])
            self.assertNotIn(rel, review['runtime_source_files'])
        self.assertTrue(WhiteoutTests().check_layers([])['image_source_bytes_verified'])

    def test_deleting_required_actual_backend_manifest_still_fails(self):
        self.assertIn('apps/backend/package.json', self.witness['runtime_source_files'])
        with self.assertRaisesRegex(c.Blocked, 'BRIDGE_ACTUAL_EXPORTED_SOURCE_MISMATCH'):
            WhiteoutTests().check_layers([], omit_source={'app/apps/backend/package.json'})

if __name__=='__main__':unittest.main()
