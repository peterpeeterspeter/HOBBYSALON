#!/usr/bin/env python3
"""Actual emitted migration gate. Only a uniquely owned template0 disposable DB.
No driver/install/build, provider calls, secrets, source ledger copies or mutations.
Every real psql script uses ON_ERROR_STOP=1; expected failures abort its session.
Exit 1 is an honest NO-GO including missing snapshot/time integrity SQL guards.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
PG = 'hs-gate-pg-53332bce'
SOURCE = 'hobbysalon_e2e_fixed_3bea5f66'
IMAGE = 'sha256:f9246f45bae2f1cff11cf7e40e2b747a6ed051190eb3c083e8d6c61f0cbf608e'
MARKER = 'hs-reconciliation-isolated-test-v1'
OUT = Path('/home/hermes/audits/hobbysalon-reconciliation-20261005/toward-go')


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def qi(value):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', value):
        raise ValueError('unsafe catalog identifier: ' + value)
    return '"' + value + '"'


def lit(value):
    return "'" + str(value).replace("'", "''") + "'"


class Gate:
    def __init__(self):
        self.db = 'hs_recon_it_' + uuid.uuid4().hex
        self.created = False
        self.report = {'scope': 'actual emitted engine DDL only; NOT business consumer/Redis/provider acceptance',
                       'database': self.db, 'marker': MARKER, 'image': IMAGE, 'history': [], 'tests': [],
                       'source_ledger_rows_copied': 0, 'provider_calls': 0, 'started': time.time()}

    def psql(self, sql, target=None, admin=False):
        target = target or self.db
        if target == SOURCE:
            assert sql.startswith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;') and sql.rstrip().endswith('ROLLBACK;')
        elif target == 'postgres':
            assert admin
        else:
            assert self.created and target == self.db and re.fullmatch(r'hs_recon_it_[a-f0-9]{32}', target)
        cmd = ['docker', 'exec', '-i', PG, 'psql', '-X', '-qAt', '-U', 'gate', '-d', target,
               '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
        p = subprocess.run(cmd, input=sql + '\n', text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=20)
        self.report['history'].append({'database': target, 'sql': sql, 'returncode': p.returncode, 'output': p.stdout})
        return p

    def ok(self, sql, **kwargs):
        p = self.psql(sql, **kwargs)
        if p.returncode:
            raise RuntimeError(p.stdout)
        return p.stdout.strip()

    def test(self, name, sql=None, reject=None, check=None, **kwargs):
        row = {'name': name}
        try:
            if sql is not None:
                p = self.psql(sql, **kwargs)
                row.update(returncode=p.returncode, output=p.stdout, sql=sql)
                if reject:
                    assert p.returncode != 0, 'UNEXPECTED ACCEPTANCE: required refusal absent'
                    assert reject in p.stdout, 'wrong refusal: ' + p.stdout
                else:
                    assert p.returncode == 0, p.stdout
                if check:
                    check(p.stdout)
            elif check:
                check()
            row['status'] = 'PASS'
        except Exception as exc:
            row['status'] = 'FAIL'
            row['error'] = str(exc)
        self.report['tests'].append(row)
        print(row['status'], name, row.get('error', ''), flush=True)
        return row

    def catalog(self):
        # Discover recursively EVERY referenced native FK table; never guess or
        # silently remove an unknown external FK. Catalog only, no ledger SELECT.
        sql = """BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH RECURSIVE native(oid) AS (
 SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('capture','order_transaction')
 UNION SELECT c.confrelid FROM pg_constraint c JOIN native n ON c.conrelid=n.oid WHERE c.contype='f'
), selected AS (SELECT oid FROM native UNION SELECT to_regclass('public.marketplace_capture_tail'))
SELECT jsonb_build_object(
 'readonly',current_setting('transaction_read_only'),'version',version(),
 'encoding',current_setting('server_encoding'),
 'sha256_builtin',(SELECT jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='pg_catalog' AND p.proname='sha256' AND pg_get_function_identity_arguments(p.oid)='bytea'),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.oid IN (SELECT oid FROM selected) AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'kind',c.contype,'target',f.relname,'def',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid LEFT JOIN pg_class f ON f.oid=c.confrelid WHERE c.conrelid IN (SELECT oid FROM selected)),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'def',pg_get_indexdef(i.indexrelid))) FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid WHERE i.indrelid IN (SELECT oid FROM selected) AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',tgname,'enabled',tgenabled,'def',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(tgfoid))) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid WHERE t.tgrelid IN (SELECT oid FROM selected) AND NOT tgisinternal),
 'enums',(SELECT jsonb_agg(jsonb_build_object('name',typname,'values',(SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))) FROM pg_type t WHERE typnamespace='public'::regnamespace AND typtype='e'),
 'sequences',(SELECT jsonb_agg(sequencename) FROM pg_sequences WHERE schemaname='public'));
ROLLBACK;"""
        cat = json.loads(self.ok(sql, target=SOURCE))
        assert cat['readonly'] == 'on'
        require(cat['encoding'] == 'UTF8' and cat['sha256_builtin'] == {'schema':'pg_catalog','name':'sha256','arguments':'bytea','returns':'bytea'})
        for required in ['marketplace_capture_tail', 'capture', 'order_transaction']:
            assert any(c['table'] == required for c in cat['columns']), required + ' absent in catalog'
        self.report['source_catalog'] = cat
        self.report['source_catalog_sha256'] = digest(cat)
        return cat

    def emit(self):
        cmd = ['docker', 'run', '--rm', '--pull=never', '--network', 'none', '--read-only', '--memory', '768m',
               '--cpus', '2', '--pids-limit', '128', '--user', '1000:1000', '--cap-drop=ALL', '--security-opt=no-new-privileges',
               '--entrypoint', 'node', '-e', 'NODE_PATH=/app/node_modules:/app/apps/backend/node_modules',
               '--mount', f'type=bind,src={ROOT},dst=/source,readonly', '-w', '/source', IMAGE,
               'scripts/tests/helpers/capture-ack-postgres.cjs']
        self.report['emission_command'] = cmd
        p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=35)
        self.report['emission_output'] = p.stdout
        if p.returncode:
            raise RuntimeError('source emission failed: ' + p.stdout)
        emitted = json.loads(p.stdout)
        for name, sha in emitted['sources'].items():
            assert digest((ROOT / name).read_bytes()) == sha, 'source hash changed: ' + name
        self.report['emitted'] = emitted
        return emitted

    def native_schema(self, cat):
        tables = sorted({c['table'] for c in cat['columns']} - {'marketplace_capture_tail'})
        ddl = ['BEGIN;']
        for enum in cat['enums'] or []:
            ddl.append('CREATE TYPE ' + qi(enum['name']) + ' AS ENUM (' + ','.join(lit(v) for v in enum['values']) + ');')
        for seq in cat['sequences'] or []:
            ddl.append('CREATE SEQUENCE ' + qi(seq) + ';')
        for table in tables:
            cols = [qi(c['name']) + ' ' + c['type'] + (' NOT NULL' if c['notnull'] else '') +
                    (' DEFAULT ' + c['default'] if c['default'] else '') for c in cat['columns'] if c['table'] == table]
            ddl.append('CREATE TABLE ' + qi(table) + '(' + ','.join(cols) + ');')
        for c in sorted(cat['constraints'] or [], key=lambda c: c['kind'] == 'f'):
            if c['table'] not in tables:
                continue
            if c['kind'] == 'f' and c['target'] not in tables:
                raise RuntimeError('unknown schema FK target, refusing partial fixture: ' + str(c))
            ddl.append('ALTER TABLE ' + qi(c['table']) + ' ADD CONSTRAINT ' + qi(c['name']) + ' ' + c['def'] + ';')
        # Candidate tail migration owns these two native unique indexes.
        for i in cat['indexes'] or []:
            if i['table'] in tables and not any(n in i['def'] for n in ['marketplace_order_capture_once', 'marketplace_payment_full_capture_once']):
                ddl.append(i['def'] + ';')
        functions = set()
        for t in cat['triggers'] or []:
            if t['table'] not in tables:
                continue
            if t['function'] not in functions:
                ddl.append(t['function'] + ';'); functions.add(t['function'])
            ddl.append(t['def'] + ';')
            if t['enabled'] != 'O':
                mode = {'A':'ENABLE ALWAYS', 'R':'ENABLE REPLICA', 'D':'DISABLE'}[t['enabled']]
                ddl.append('ALTER TABLE ' + qi(t['table']) + ' ' + mode + ' TRIGGER ' + qi(t['name']) + ';')
        ddl.append('COMMIT;')
        self.ok('\n'.join(ddl))
        self.report['native_schema_tables'] = tables
        self.report['omitted_fk_constraints'] = []

    def seed_sql(self, f, accounting='2026-01-01 10:00Z', enqueue='2026-01-01 10:01Z', complete='2026-01-01 10:02Z'):
        values = [f['payment_id'], f['cart_id'], f['capture_id'], json.dumps(f['snapshot']), f['event_id'], accounting, enqueue, complete]
        return 'INSERT INTO marketplace_capture_tail(payment_id,cart_id,capture_id,snapshot,event_id,accounting_at,event_enqueued_at,completed_at) VALUES (' + ','.join('NULL' if v is None else lit(v) for v in values) + ');'

    def seed(self, f, accounting='2026-01-01 10:00Z', enqueue='2026-01-01 10:01Z', complete='2026-01-01 10:02Z'):
        self.ok(self.seed_sql(f, accounting, enqueue, complete))

    def insert(self, f, **overrides):
        values = dict(payment_id=f['payment_id'], cart_id=f['cart_id'], capture_id=f['capture_id'], event_id=f['event_id'],
                      snapshot_sha256=f['hash'], subscriber_id='split-payment-payment-captured-handler', protocol_version=1)
        values.update(overrides)
        return 'INSERT INTO marketplace_capture_consumer_ack(' + ','.join(values) + ') VALUES(' + ','.join(lit(v) for v in values.values()) + ')'

    def run(self):
        cat = self.catalog()  # always schema-first before creation/fixture construction
        emitted = self.emit()
        self.ok('CREATE DATABASE ' + qi(self.db) + ' TEMPLATE template0;', target='postgres', admin=True)
        self.created = True
        self.ok('COMMENT ON DATABASE ' + qi(self.db) + ' IS ' + lit(MARKER) + ';', target='postgres', admin=True)
        self.native_schema(cat)
        self.ok('BEGIN;\n' + '\n'.join(emitted['tail']['up']) + '\nCOMMIT;')
        expected = {c['name']: c['def'] for c in cat['constraints'] if c['table'] == 'marketplace_capture_tail'}
        self.test('actual emitted tail constraints match readonly source catalog', "SELECT jsonb_object_agg(conname,pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='marketplace_capture_tail'::regclass;", check=lambda s: require(json.loads(s) == expected))
        self.test('all native copied FK constraints validated without exclusions', "SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;", check=lambda s: require(s.strip() == '0'))
        fx = emitted['fixtures']
        self.seed(fx['valid'])
        self.test('ACK relation absent before migration', "SELECT to_regclass('marketplace_capture_consumer_ack') IS NULL;", check=lambda s: require(s.strip() == 't'))
        self.test('actual ACK up full script transactional', 'BEGIN;\n' + '\n'.join(emitted['ack']['up']) + '\nCOMMIT;')
        self.test('zero historical ACK/no backfill', 'SELECT count(*) FROM marketplace_capture_consumer_ack;', check=lambda s: require(s.strip() == '0'))
        self.test('empty down then up full scripts', 'BEGIN;\n' + '\n'.join(emitted['ack']['down']) + '\nCOMMIT;\nSELECT count(*) FROM pg_proc WHERE proname IN (\'marketplace_capture_ack_ready\',\'marketplace_capture_ack_canonical\',\'marketplace_capture_ack_immutable\');\nBEGIN;\n' + '\n'.join(emitted['ack']['up']) + '\nCOMMIT;', check=lambda s: require(s.strip() == '0'))
        self.test('ACK guards truly ALWAYS + validated exact RESTRICT FK', "SELECT jsonb_build_object('triggers',(SELECT jsonb_agg(tgenabled ORDER BY tgname) FROM pg_trigger WHERE tgrelid='marketplace_capture_consumer_ack'::regclass AND NOT tgisinternal),'fk',(SELECT jsonb_build_object('validated',convalidated,'update',confupdtype,'delete',confdeltype,'def',pg_get_constraintdef(oid)) FROM pg_constraint WHERE conname='marketplace_capture_ack_tail_fk'));", check=lambda s: require(json.loads(s)['triggers'] == ['A','A','A'] and json.loads(s)['fk']['validated'] and json.loads(s)['fk']['update'] == 'r' and json.loads(s)['fk']['delete'] == 'r'))
        pos = self.test('autocommit positive actual TS snapshot hash', 'SET synchronous_commit=on; SELECT pg_backend_pid();\n' + self.insert(fx['valid']) + ' RETURNING row_to_json(marketplace_capture_consumer_ack);')
        pid = pos.get('output', '').splitlines()[0]
        self.test('second physical session durable readback', "SELECT pg_backend_pid(); SELECT row_to_json(a) FROM marketplace_capture_consumer_ack a WHERE payment_id='pay_ack_valid';", check=lambda s: require(s.splitlines()[0] != pid and json.loads(s.splitlines()[1])['snapshot_sha256'] == fx['valid']['hash']))
        self.test('ON CONFLICT replay retains exactly one unchanged receipt', self.insert(fx['valid']) + ' ON CONFLICT(payment_id) DO NOTHING; SELECT count(*) FROM marketplace_capture_consumer_ack; SELECT row_to_json(a) FROM marketplace_capture_consumer_ack a;', check=lambda s: require(s.splitlines()[0] == '1' and json.loads(s.splitlines()[1]) == json.loads(pos['output'].splitlines()[1])))
        self.test('duplicate plain insert refused', 'BEGIN;' + self.insert(fx['valid']) + ';COMMIT;', reject='23505')
        for replica in [False, True]:
            mode = 'replica' if replica else 'ordinary'
            prefix = 'BEGIN;' + ('SET LOCAL session_replication_role=replica;' if replica else '')
            for verb, sql in [('UPDATE', "UPDATE marketplace_capture_consumer_ack SET acked_at=acked_at WHERE payment_id='pay_ack_valid'"), ('DELETE', "DELETE FROM marketplace_capture_consumer_ack WHERE payment_id='pay_ack_valid'"), ('TRUNCATE', 'TRUNCATE marketplace_capture_consumer_ack')]:
                self.test(mode + ' ' + verb + ' always append-only refusal', prefix + sql + ';COMMIT;', reject='marketplace capture ACK is append-only')
            self.test(mode + ' missing exact tail refusal', prefix + self.insert(fx['valid'], payment_id='missing_payment') + ';COMMIT;', reject='requires exact ready tail')
            for field in ['cart_id', 'capture_id', 'event_id']:
                self.test(mode + ' FK identity ' + field + ' mismatch refused', prefix + self.insert(fx['valid'], **{field: 'wrong_' + field}) + ';COMMIT;', reject='requires exact ready tail')
        for name, stamps in [('pending_accounting', (None,None,None)), ('pending_enqueue', ('2026-01-01 10:00Z',None,None)), ('pending_complete', ('2026-01-01 10:00Z','2026-01-01 10:01Z',None))]:
            self.seed(fx[name], *stamps)
            for replica in [False,True]:
                self.test(name + (' replica' if replica else ''), 'BEGIN;' + ('SET LOCAL session_replication_role=replica;' if replica else '') + self.insert(fx[name]) + ';COMMIT;', reject='requires exact ready tail')
        for name, changes, code in [('event/hash mismatch', {'snapshot_sha256':'1'*64}, '23514'), ('malformed hash', {'snapshot_sha256':'X'*64}, '23514'), ('subscriber mismatch', {'subscriber_id':'forged'}, '23514'), ('protocol mismatch', {'protocol_version':2}, '23514'), ('ACK infinity', {'acked_at':'infinity'}, '23514')]:
            self.test(name + ' refusal', 'BEGIN;' + self.insert(fx['valid'], **changes) + ';COMMIT;', reject=code)
        self.test('down populated refuses evidence loss atomically', 'BEGIN;\n' + '\n'.join(emitted['ack']['down']) + '\nCOMMIT;', reject='refusing rollback with durable capture ACK evidence')
        self.test('receipt intact after failures/down refusal', "SELECT count(*) FROM marketplace_capture_consumer_ack; SELECT count(*) FROM pg_constraint WHERE conname='marketplace_capture_tail_ack_identity';", check=lambda s: require(s.splitlines() == ['1','1']))
        # These REQUIREMENTS are intentionally not softened to the current SQL.
        # Correct event binding alone must not authorize a forged snapshot hash.
        forged = dict(fx['forged'], hash='0'*64, event_id='marketplace-captured-'+'0'*64)
        require(forged['hash'] != fx['forged']['hash'])
        self.seed(forged)
        self.test('forged snapshot SHA with correct event binding MUST refuse', 'BEGIN;' + self.insert(forged) + ';COMMIT;', reject='ERROR:')
        self.report['forged_reproduction'] = {'actual_TS_hash': fx['forged']['hash'], 'forged_hash': forged['hash'], 'snapshot': forged['snapshot']}
        for name, acked in [('early_ack','2025-01-01 00:00Z'), ('future_ack','2099-01-01 00:00Z')]:
            self.seed(fx[name])
            self.test(name + ' timestamp consistency MUST refuse', 'BEGIN;' + self.insert(fx[name], acked_at=acked) + ';COMMIT;', reject='ERROR:')
        self.seed(fx['reversed_tail'], '2026-01-01 12:00Z', '2026-01-01 11:00Z', '2026-01-01 10:00Z')
        self.test('reversed ready tail chronology MUST refuse', 'BEGIN;' + self.insert(fx['reversed_tail']) + ';COMMIT;', reject='ERROR:')
        self.seed(fx['infinite_tail'], 'infinity', 'infinity', 'infinity')
        self.test('nonfinite ready tail timestamps MUST refuse', 'BEGIN;' + self.insert(fx['infinite_tail']) + ';COMMIT;', reject='ERROR:')
        self.seed(fx['empty_allocations'])
        self.test('empty snapshot allocations MUST refuse (TS binding rejects)', 'BEGIN;' + self.insert(fx['empty_allocations']) + ';COMMIT;', reject='ERROR:')
        # Repeat the original six gap refusals under replica mode: ALWAYS remains effective.
        for name, fixture, overrides in [('forged',forged,{}),('early_ack',fx['early_ack'],{'acked_at':'2025-01-01'}),('future_ack',fx['future_ack'],{'acked_at':'2099-01-01'}),('reversed_tail',fx['reversed_tail'],{}),('infinite_tail',fx['infinite_tail'],{}),('empty_allocations',fx['empty_allocations'],{})]:
            self.test('original gap replica ' + name, 'BEGIN;SET LOCAL session_replication_role=replica;' + self.insert(fixture, **overrides) + ';COMMIT;', reject='23514')
        for name, stamps in [('each_infinite_accounting',('infinity','2026-01-01','2026-01-01')),('each_infinite_enqueue',('2026-01-01','infinity','2026-01-01')),('each_infinite_complete',('2026-01-01','2026-01-01','infinity')),('enqueue_reversed',('2026-01-01 10:00Z','2026-01-01 12:00Z','2026-01-01 11:00Z'))]:
            self.seed(fx[name], *stamps)
            self.test(name + ' independent timeline refusal', 'BEGIN;' + self.insert(fx[name]) + ';COMMIT;', reject='23514')
        for name in ['long_key','empty_key']:
            self.seed(fx[name])
            self.test(name + ' explicit ASCII key contract refusal', 'BEGIN;' + self.insert(fx[name]) + ';COMMIT;', reject='23514')
        for stamp in ['-infinity','NaN']:
            self.test('ACK invalid timestamp ' + stamp, 'BEGIN;' + self.insert(fx['valid'], acked_at=stamp) + ';COMMIT;', reject='23514' if stamp == '-infinity' else '22007')
        changed = dict(fx['changed_unknown'], snapshot=dict(fx['changed_unknown']['snapshot']))
        changed['snapshot']['unknown_metadata'] = {'nested':['MUTATED']}
        self.seed(changed)
        for replica in [False,True]:
            self.test('unknown nested metadata tampering hash refuses' + (' replica' if replica else ''), 'BEGIN;' + ('SET LOCAL session_replication_role=replica;' if replica else '') + self.insert(changed) + ';COMMIT;', reject='capture ACK snapshot hash mismatch')
        self.test('safe integer numeric token normalization exact', "SELECT marketplace_capture_ack_canonical('{\"a\":1.000,\"b\":1e3,\"c\":-0}'::jsonb);", check=lambda s: require(s.strip() == '{"a":1,"b":1000,"c":0}'))
        # Independent real TS-vs-SQL byte comparisons, including unknown fields.
        for i, case in enumerate(emitted['canonicalCases']):
            sql = 'SELECT to_json(marketplace_capture_ack_canonical(' + lit(json.dumps(case['value'])) + '::jsonb));'
            self.test('canonical TS SQL exact unicode/control/array case ' + str(i), sql, check=lambda s, key=case['key']: require(json.loads(s) == key))
        for name in ['string_version','fractional','unsafe_integer','unicode_key','control_key','oversize','deep','object_bound','array_bound']:
            self.seed(fx[name])
            for replica in [False, True]:
                self.test(name + (' replica' if replica else '') + ' snapshot contract refuses', 'BEGIN;' + ('SET LOCAL session_replication_role=replica;' if replica else '') + self.insert(fx[name]) + ';COMMIT;', reject='23514')
        for name, stamps in [('negative_infinite_tail',('-infinity','-infinity','-infinity')),('future_tail',('2099-01-01','2099-01-01','2099-01-01'))]:
            self.seed(fx[name], *stamps)
            self.test(name + ' timeline refuses', 'BEGIN;' + self.insert(fx[name]) + ';COMMIT;', reject='23514')
        for field, value in [('version', None),('version',2),('payment_id','wrong'),('cart_id','wrong'),('allocations',{}),('allocations',None)]:
            invalid = dict(fx['valid'], snapshot=dict(fx['valid']['snapshot']))
            invalid['snapshot'][field] = value
            self.test('actual tail shape precondition ' + field + ' ' + json.dumps(value), 'BEGIN;' + self.seed_sql(invalid) + 'COMMIT;', reject='23514')
        # PG precision must never masquerade as an equal JS value after rounding.
        for token in ['9007199254740993','1.0000000000000000001','0.00000000000000000001']:
            self.test('exact numeric unsupported token ' + token, 'SELECT marketplace_capture_ack_canonical(' + lit('{"n":'+token+'}') + '::jsonb);', reject='23514')
        self.seed(fx['equal_timeline'], '2026-01-01','2026-01-01','2026-01-01')
        self.test('equal finite timeline accepted', self.insert(fx['equal_timeline'], acked_at='2026-01-01') + ';')
        self.seed(fx['unicode_unknown'])
        self.test('full unknown unicode metadata actual ACK accepts exact TS hash', self.insert(fx['unicode_unknown']) + ';')
        self.test('unknown metadata mutation cannot retain old hash', 'BEGIN;SELECT marketplace_capture_ack_canonical(' + lit(json.dumps(fx['unicode_unknown']['snapshot'])) + "::jsonb || '{\"unknown_metadata\":\"changed\"}'::jsonb) <> " + lit(fx['unicode_unknown']['key']) + ';ROLLBACK;', check=lambda s: require(s.strip() == 't'))
        self.report['final_ack_rows'] = json.loads(self.ok("SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY payment_id),'[]') FROM marketplace_capture_consumer_ack a;"))
        self.test('exactly three expected durable receipts, rejected cases absent', check=lambda: require([r['payment_id'] for r in self.report['final_ack_rows']] == sorted([fx[n]['payment_id'] for n in ['valid','equal_timeline','unicode_unknown']])))
        self.test('source SHA unchanged after execution', check=lambda: require(all(digest((ROOT / name).read_bytes()) == sha for name, sha in emitted['sources'].items())))

    def cleanup(self):
        if self.created:
            # Marker and exact own UUID must match. No wildcard drop / CASCADE.
            marker = self.ok('SELECT shobj_description(oid,\'pg_database\') FROM pg_database WHERE datname=' + lit(self.db) + ';', target='postgres', admin=True)
            require(marker == MARKER)
            self.ok('DROP DATABASE ' + qi(self.db) + ';', target='postgres', admin=True)
            remaining = self.ok('SELECT count(*) FROM pg_database WHERE datname=' + lit(self.db) + ';', target='postgres', admin=True)
            self.report['cleanup'] = {'own_database_only': True, 'remaining_count': int(remaining), 'removed': remaining == '0'}
        else:
            self.report['cleanup'] = {'database_not_created': True}


def require(condition):
    if not condition:
        raise AssertionError('assertion failed')


def main():
    g = Gate()
    try:
        g.run()
    except Exception as exc:
        g.report['fatal'] = str(exc)
        print('FATAL', str(exc), flush=True)
    finally:
        try:
            g.cleanup()
        except Exception as exc:
            g.report['cleanup_error'] = str(exc)
        g.report['counts'] = {status: sum(t['status'] == status for t in g.report['tests']) for status in ['PASS','FAIL']}
        g.report['counts']['total'] = len(g.report['tests'])
        g.report['elapsed_seconds'] = round(time.time()-g.report['started'], 3)
        g.report['result'] = 'NO-GO' if g.report['counts']['FAIL'] or g.report.get('fatal') or g.report.get('cleanup_error') else 'PASS engine DDL only'
        g.report['artifact_hashes'] = {str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in [Path(__file__), ROOT/'scripts/tests/helpers/capture-ack-postgres.cjs']}
        OUT.mkdir(parents=True, exist_ok=True)
        report = OUT / ('ACK-PG-REMEDIATION-' + g.db + '.json')
        raw = (json.dumps(g.report, indent=2, ensure_ascii=False)+'\n').encode()
        report.write_bytes(raw)
        report.with_suffix('.sha256').write_text(digest(raw)+'  '+report.name+'\n')
        print(json.dumps({'result': g.report['result'], 'counts': g.report['counts'], 'cleanup': g.report.get('cleanup'), 'report': str(report), 'sha256': digest(raw)}), flush=True)
    return int(g.report['result'].startswith('NO-GO'))


if __name__ == '__main__':
    raise SystemExit(main())
