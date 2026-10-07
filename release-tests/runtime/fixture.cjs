'use strict';
// Physical storage fixtures only: NOT authenticated provider evidence or repair plans.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { inspect } = require('node:util');
// Stderr is subprocess-captured into private failure receipts, never a PASS receipt.
// These markers are deliberately outside the public runtime projector allowlist.
let fixtureStage = 'FIXTURE_DEPENDENCIES';
function checkpoint(stage) {
  fixtureStage = stage; // All callers below supply fixed source literals, never DB values.
  console.error(JSON.stringify({marker:'CI_FIXTURE_DIAGNOSTIC',stage,code:'FIXTURE_CHECKPOINT'}));
}
function fixtureFailed(error) {
  console.error('FIXTURE_FAILED'); // Preserve the existing failure sentinel and exit contract.
  const code = pgFailure(error,'ERR_ASSERTION') ? 'FIXTURE_ASSERTION_FAILED' : 'FIXTURE_FAILED';
  console.error(JSON.stringify({marker:'CI_FIXTURE_DIAGNOSTIC',stage:fixtureStage,code}));
  // One JSON line prevents error text from masquerading as a public diagnostic record.
  // Do not scrub this private copy: the original stack, nested causes and driver details
  // are needed for diagnosis. The harness never prints either failed-command stream;
  // the workflow retains raw receipts only inside the encrypted diagnostic artifact.
  console.error(JSON.stringify({marker:'CI_FIXTURE_PRIVATE_ERROR',error:inspect(error,{depth:8,customInspect:false,getters:false})}));
  process.exitCode = 1;
}
const IMMUTABLE_MESSAGE = 'reconciliation audit is immutable: update/delete/truncate forbidden';
const AUDIT_COLUMNS = [['id','text'],['plan_hash','text'],['case_id','text'],['actor','text'],['evidence','jsonb'],['before_snapshot','jsonb'],['after_snapshot','jsonb'],['created_at','timestamp with time zone']];
const AUDIT_CHECKS = [
  "CHECK (plan_hash ~ '^[a-f0-9]{64}$')",
  'CHECK (length(case_id) >= 1 AND length(case_id) <= 255)',
  'CHECK (length(actor) >= 1 AND length(actor) <= 255)',
  "CHECK (jsonb_typeof(evidence) = 'object')",
  "CHECK (jsonb_typeof(before_snapshot) = 'object')",
  "CHECK (jsonb_typeof(after_snapshot) = 'object')",
  "CHECK (id = 'recon_' || plan_hash)",
  "CHECK ((evidence->'provider'->>'account_id' ~ '^acct_[A-Za-z0-9]{1,200}$' AND evidence->'provider'->>'provider_effect_id' ~ '^(ch|re)_[A-Za-z0-9]{1,200}$') IS TRUE)"
];
// Ignore only PostgreSQL deparser casts/grouping/whitespace, preserving literals.
function tokens(sql) {
  return (sql.match(/'(?:''|[^'])*'|::[a-z]+|[a-z_][a-z_0-9]*|[^\s()]/gi) || [])
    .filter(t => !/^::/i.test(t)).map(t => t.startsWith("'") ? t : t.toLowerCase()).join('');
}
function pgFailure(error, code, message = null, constraint = null) {
  for (let e = error, depth = 0; e && depth < 5; e = e.originalError || e.cause, depth++) {
    if (e.code === code && (!message || (e.message === message || e.message.endsWith(' - ' + message))) && (!constraint || e.constraint === constraint)) return true;
  }
  return false;
}
function validateAuditCatalog(c) {
  assert.deepEqual(c.columns.map(x => [x.name,x.type]), AUDIT_COLUMNS);
  assert.ok(c.columns.every(x => x.not_null === true));
  const pks = c.constraints.filter(x => x.kind === 'p');
  assert.equal(pks.length,1); assert.deepEqual(pks[0].columns,['id']);
  assert.ok(c.constraints.every(x => x.validated === true));
  assert.deepEqual(c.constraints.filter(x => x.kind === 'c').map(x => tokens(x.definition)).sort(), AUDIT_CHECKS.map(tokens).sort());
  const index = c.indexes.find(x => x.name === 'reconciliation_repair_audit_effect_once');
  assert.ok(index && index.unique === true && index.valid === true && index.ready === true);
  assert.equal(index.key_count,2); assert.equal(index.attribute_count,2); assert.equal(index.predicate,null);
  assert.deepEqual(index.keys.map(tokens), ["evidence->'provider'->>'account_id'","evidence->'provider'->>'provider_effect_id'"].map(tokens));
  assert.equal(c.triggers.length,2);
  for (const [name,type] of [['reconciliation_repair_audit_immutable',27],['reconciliation_repair_audit_no_truncate',34]]) {
    const t = c.triggers.find(x => x.name === name); assert.ok(t);
    assert.equal(t.type,type); assert.equal(t.enabled,'A'); assert.equal(t.when,null);
    assert.equal(t.function_schema,'public'); assert.equal(t.function_name,'reconciliation_repair_audit_immutable');
  }
  assert.equal(c.functions.length,1);
  const f = c.functions[0]; assert.equal(f.name,'reconciliation_repair_audit_immutable'); assert.equal(f.schema,'public');
  assert.equal(f.security_definer,false); assert.equal(f.result,'trigger'); assert.equal(f.language,'plpgsql');
  // Exact unconditional body; CREATE OR REPLACE here is pg_get_functiondef output, NOT fixture DDL.
  const body = f.definition.match(/\$(\w*)\$([\s\S]*?)\$\1\$/);
  assert.ok(body);
  assert.match(body[2].trim(), /^BEGIN\s+RAISE EXCEPTION 'reconciliation audit is immutable: update\/delete\/truncate forbidden';\s+END;?$/);
  return c;
}
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function catalog(read) {
  checkpoint('FIXTURE_CATALOG_COLUMNS');
  const columns = await read(`SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null FROM pg_attribute a WHERE a.attrelid='public.reconciliation_repair_audit'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`);
  checkpoint('FIXTURE_CATALOG_CONSTRAINTS');
  const constraints = await read(`SELECT c.conname AS name,c.contype AS kind,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition,to_json(ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord)) AS columns FROM pg_constraint c WHERE c.conrelid='public.reconciliation_repair_audit'::regclass ORDER BY c.conname`);
  checkpoint('FIXTURE_CATALOG_INDEXES');
  const indexes = await read(`SELECT cl.relname AS name,i.indisunique AS "unique",i.indisvalid AS valid,i.indisready AS ready,i.indnkeyatts AS key_count,i.indnatts AS attribute_count,pg_get_expr(i.indpred,i.indrelid) AS predicate,to_json(ARRAY(SELECT pg_get_indexdef(i.indexrelid,n,true) FROM generate_series(1,i.indnkeyatts) n)) AS keys FROM pg_index i JOIN pg_class cl ON cl.oid=i.indexrelid WHERE i.indrelid='public.reconciliation_repair_audit'::regclass ORDER BY cl.relname`);
  checkpoint('FIXTURE_CATALOG_TRIGGERS');
  const triggers = await read(`SELECT t.tgname AS name,t.tgtype AS type,t.tgenabled AS enabled,pg_get_expr(t.tgqual,t.tgrelid) AS "when",n.nspname AS function_schema,p.proname AS function_name FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.reconciliation_repair_audit'::regclass AND NOT t.tgisinternal ORDER BY t.tgname`);
  checkpoint('FIXTURE_CATALOG_FUNCTIONS');
  const functions = await read(`SELECT p.proname AS name,n.nspname AS schema,p.prosecdef AS security_definer,pg_get_function_result(p.oid) AS result,l.lanname AS language,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE p.oid='public.reconciliation_repair_audit_immutable()'::regprocedure`);
  checkpoint('FIXTURE_CATALOG_ASSERTIONS');
  return validateAuditCatalog({columns,constraints,indexes,triggers,functions});
}
async function main() {
  // Existing image dependency only; offline import of assertion helpers loads no ORM.
  checkpoint('FIXTURE_DEPENDENCIES');
  const { MikroORM } = require('/app/node_modules/@mikro-orm/postgresql');
  const { applyMarketplaceWebhookTransaction, readCommittedMarketplaceWebhookReceipt } = require('/app/apps/backend/.medusa/server/src/utils/marketplace-webhook-transaction.js');
  const options = () => ({ entities: [], discovery: { warnWhenNoEntities: false }, clientUrl: process.env.DATABASE_URL, schema: 'public',
    pool: { min: 0,max: 1,acquireTimeoutMillis: 5000,createTimeoutMillis: 5000,
      afterCreate(connection,done) { connection.query("SET lock_timeout = '2s'; SET statement_timeout = '5s'; SET idle_in_transaction_session_timeout = '10s'",error => done(error,connection)); } },
    driverOptions: { connection: { connectionTimeoutMillis: 5000 } } });
  let orm,observer,observerConnection;
  const deadline = setTimeout(() => { console.error('FIXTURE_DEADLINE'); console.error(JSON.stringify({marker:'CI_FIXTURE_DIAGNOSTIC',stage:fixtureStage,code:'FIXTURE_DEADLINE'})); process.exit(1); },90000);
  try {
    checkpoint('FIXTURE_PRIMARY_CONNECT');
    orm = await MikroORM.init(options());
    checkpoint('FIXTURE_OBSERVER_CONNECT');
    observer = await MikroORM.init(options());
    checkpoint('FIXTURE_SESSION_SETUP');
    const em = orm.em.fork({ useContext: false });
    const observerKnex = observer.em.getConnection().getKnex();
    observerConnection = await observerKnex.client.acquireConnection();
    // Pinned physical session; never an EntityManager ambient/RequestContext read.
    const read = async (sql,bindings=[]) => (await observerKnex.raw(sql,bindings).connection(observerConnection)).rows;
    checkpoint('FIXTURE_ROLE_DENIALS');
    await assert.rejects(em.execute('CREATE TABLE forbidden_runtime_ddl(id text)'), /permission denied/);
    await assert.rejects(em.execute('CREATE TEMP TABLE forbidden_runtime_temp(id text)'), /permission denied/);
    await assert.rejects(em.execute('ALTER TABLE ci_acceptance_sentinel ADD COLUMN forbidden text'), /must be owner|permission denied/);
    const identity = n => ({ event_id: `evt_ci_fixture_${n}`, provider_id: 'integration-fixture', action: 'successful', data: { cart_id: 'cart_ci_fixture', session_id: 'ps_ci_fixture', payment_collection_id: 'paycol_ci_fixture', payment_intent_id: 'pi_ci_fixture', amount: '100', currency_code: 'eur' } });
    checkpoint('FIXTURE_WEBHOOK_COMMIT');
    const input = identity('durable');
    const first = await applyMarketplaceWebhookTransaction(em,input,async scope => {
      await scope.execute("INSERT INTO ci_acceptance_sentinel(id,payload) VALUES ('business_fixture', '{\"source\":\"integration-fixture\"}')"); return 'committed';
    });
    assert.equal(first.duplicate,false); assert.equal(await readCommittedMarketplaceWebhookReceipt(em,input),true);
    checkpoint('FIXTURE_WEBHOOK_DUPLICATE');
    const duplicate = await applyMarketplaceWebhookTransaction(em,input,async () => { throw new Error('duplicate side effect'); });
    assert.equal(duplicate.duplicate,true);
    checkpoint('FIXTURE_WEBHOOK_ROLLBACK');
    let rollbackBarrierReached = false;
    await assert.rejects(applyMarketplaceWebhookTransaction(em,identity('aborted'),async scope => {
      await scope.execute("INSERT INTO ci_acceptance_sentinel(id,payload) VALUES ('aborted_fixture','{}')"); rollbackBarrierReached=true; throw new Error('intentional fixture rollback');
    }),{ message: 'intentional fixture rollback' });
    assert.equal(rollbackBarrierReached,true,'intentional rollback write barrier must be reached');
    assert.equal(await readCommittedMarketplaceWebhookReceipt(em,identity('aborted')),false);
    assert.equal((await em.execute("SELECT id FROM ci_acceptance_sentinel WHERE id='aborted_fixture'")).length,0);
    const nativeCatalog = await catalog(read), schemaHash = hash(nativeCatalog);
    checkpoint('FIXTURE_AUDIT_INITIAL_STATE');
    const rows = async () => read('SELECT to_jsonb(a)::text AS row FROM public.reconciliation_repair_audit a ORDER BY id COLLATE "C"');
    assert.deepEqual(await rows(),[], 'native audit initially empty');
    const observerIdentity = (await read('SELECT pg_backend_pid() AS pid,current_database() AS db,current_schema() AS schema,current_user AS role'))[0];
    assert.equal(observerIdentity.role,'app'); assert.equal(observerIdentity.schema,'public'); assert.equal(observerIdentity.db,'acceptance');
    const assertions = { native_catalog:true }, counts = {};
    let sequence = 0;
    const make = () => { const plan_hash = createHash('sha256').update('synthetic-physical-storage-fixture-'+(++sequence)).digest('hex'); return {
      id:'recon_'+plan_hash,plan_hash,case_id:'synthetic-storage-only',actor:'fixture-not-repair-authority',
      evidence:{ synthetic_storage_only:true,provider:{account_id:'acct_FixtureA',provider_effect_id:'ch_Fixture'+sequence},large_integer:'9007199254740993' },
      before_snapshot:{synthetic:true,value:'before'},after_snapshot:{synthetic:true,value:'after'},created_at:'2026-10-07T00:00:00.123456Z' }; };
    const SQL_NULL = Symbol('explicit SQL NULL');
    const insert = async (tx,value) => {
      const bindings = AUDIT_COLUMNS.map(([key,type]) => value[key] === SQL_NULL ? null : type === 'jsonb' ? JSON.stringify(value[key]) : value[key]);
      return tx.execute('INSERT INTO public.reconciliation_repair_audit(id,plan_hash,case_id,actor,evidence,before_snapshot,after_snapshot,created_at) VALUES (?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::timestamptz) RETURNING id',bindings);
    };
    const bounded = async tx => {
      await tx.execute("SET LOCAL lock_timeout = '2s'");
      await tx.execute("SET LOCAL statement_timeout = '5s'");
      await tx.execute("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    };
    const visible = async (value,sentinel,expected) => {
      assert.equal((await read('SELECT id FROM public.reconciliation_repair_audit WHERE id=?',[value.id])).length,expected);
      assert.equal((await read('SELECT id FROM public.ci_acceptance_sentinel WHERE id=?',[sentinel])).length,expected);
    };
    checkpoint('FIXTURE_AUDIT_COMMIT');
    const committed = make();
    await em.transactional(async tx => {
      await bounded(tx); const writerIdentity = (await tx.execute('SELECT pg_backend_pid() AS pid,current_database() AS db,current_schema() AS schema,current_user AS role'))[0];
      assert.notEqual(writerIdentity.pid,observerIdentity.pid); assert.deepEqual({...writerIdentity,pid:0},{...observerIdentity,pid:0});
      assert.equal((await insert(tx,committed))[0].id,committed.id);
      await tx.execute('INSERT INTO public.ci_acceptance_sentinel(id,payload) VALUES (?,?::jsonb)',['audit_commit_fixture',JSON.stringify({synthetic:true})]);
      await visible(committed,'audit_commit_fixture',0); assertions.distinct_observer_pid=true; assertions.before_commit_invisible=true;
    },{ clear:true });
    checkpoint('FIXTURE_AUDIT_EXACT_FIELDS');
    await visible(committed,'audit_commit_fixture',1);
    const exact = await read(`SELECT id FROM public.reconciliation_repair_audit WHERE id=? AND plan_hash=? AND case_id=? AND actor=? AND evidence=?::jsonb AND before_snapshot=?::jsonb AND after_snapshot=?::jsonb AND created_at=?::timestamptz`,AUDIT_COLUMNS.map(([key,type]) => type === 'jsonb' ? JSON.stringify(committed[key]) : committed[key]));
    assert.equal(exact.length,1); assertions.after_commit_visible=true; assertions.exact_eight_fields=true;
    checkpoint('FIXTURE_AUDIT_ROLLBACK');
    const aborted = make(); let auditRollbackBarrierReached=false;
    await assert.rejects(em.transactional(async tx => {
      await bounded(tx); await insert(tx,aborted);
      await tx.execute('INSERT INTO public.ci_acceptance_sentinel(id,payload) VALUES (?,?::jsonb)',['audit_rollback_fixture','{}']);
      await visible(aborted,'audit_rollback_fixture',0); auditRollbackBarrierReached=true; throw new Error('intentional audit fixture rollback');
    },{clear:true}),{message:'intentional audit fixture rollback'});
    assert.equal(auditRollbackBarrierReached,true); await visible(aborted,'audit_rollback_fixture',0); assertions.rollback_barrier=true; assertions.rollback_invisible=true;
    const unchanged = async before => { assert.deepEqual(await rows(),before); assert.equal(hash(await catalog(read)),schemaHash); };
    const rejects = async (label,operation,code,message=null,constraint=null) => {
      const before = await rows();
      await assert.rejects(em.transactional(async tx => { await bounded(tx); await operation(tx); },{clear:true}),error => pgFailure(error,code,message,constraint));
      await unchanged(before); counts[label]=(counts[label] || 0)+1;
    };
    checkpoint('FIXTURE_AUDIT_UNIQUENESS');
    const pk = nativeCatalog.constraints.find(x => x.kind === 'p').name;
    const pkDuplicate = make(); pkDuplicate.id=committed.id; pkDuplicate.plan_hash=committed.plan_hash;
    await rejects('uniqueness',tx => insert(tx,pkDuplicate),'23505',null,pk);
    const effectDuplicate = make(); effectDuplicate.evidence.provider={...committed.evidence.provider};
    await rejects('uniqueness',tx => insert(tx,effectDuplicate),'23505',null,'reconciliation_repair_audit_effect_once');
    checkpoint('FIXTURE_AUDIT_COMPOSITE_BOUNDARIES');
    const otherAccount = make(); otherAccount.evidence.provider={...committed.evidence.provider,account_id:'acct_FixtureB'};
    const otherEffect = make();
    for (const value of [otherAccount,otherEffect]) await em.transactional(async tx => { await bounded(tx); await insert(tx,value); },{clear:true});
    assertions.composite_boundaries=true;
    checkpoint('FIXTURE_AUDIT_NOT_NULL');
    for (const [key] of AUDIT_COLUMNS) { const value=make();value[key]=SQL_NULL;await rejects('not_null',tx => insert(tx,value),'23502'); }
    checkpoint('FIXTURE_AUDIT_PLAN_HASH');
    for (const invalid of ['g'.repeat(64),'A'.repeat(64),'a'.repeat(63)]) { const value=make();value.plan_hash=invalid;value.id='recon_'+invalid;await rejects('plan_hash',tx => insert(tx,value),'23514'); }
    checkpoint('FIXTURE_AUDIT_ID_HASH');
    const mismatch=make();mismatch.id='recon_'+'f'.repeat(64);await rejects('id_hash',tx => insert(tx,mismatch),'23514');
    checkpoint('FIXTURE_AUDIT_LENGTHS');
    for (const key of ['case_id','actor']) for (const invalid of ['', 'a'.repeat(256)]) {const value=make();value[key]=invalid;await rejects('lengths',tx => insert(tx,value),'23514');}
    checkpoint('FIXTURE_AUDIT_JSON_OBJECTS');
    for (const key of ['evidence','before_snapshot','after_snapshot']) for (const invalid of [[],42,null]) {const value=make();value[key]=invalid;await rejects('json_objects',tx => insert(tx,value),'23514');}
    checkpoint('FIXTURE_AUDIT_PROVIDER');
    const validProvider={account_id:'acct_Valid',provider_effect_id:'re_Valid'};
    const providers=[undefined,null,{}, {provider_effect_id:'ch_Valid'}, {account_id:'acct_Valid'},
      {...validProvider,account_id:null},{...validProvider,provider_effect_id:null},
      {...validProvider,account_id:'bad_Valid'},{...validProvider,account_id:'acct_bad!'}, {...validProvider,account_id:'acct_'+'a'.repeat(201)}, {...validProvider,account_id:''},
      {...validProvider,provider_effect_id:'pi_Valid'},{...validProvider,provider_effect_id:'ch_bad!'},{...validProvider,provider_effect_id:'ch_'+'a'.repeat(201)},{...validProvider,provider_effect_id:''}];
    for (const provider of providers) {const value=make();value.evidence={synthetic_storage_only:true,provider};await rejects('provider',tx => insert(tx,value),'23514');}
    assertions.native_constraints=true;assertions.schema_unchanged_after_failures=true;
    checkpoint('FIXTURE_AUDIT_ROW_GUARDS');
    for (const sql of ['UPDATE public.reconciliation_repair_audit SET actor=actor WHERE id=?','UPDATE public.reconciliation_repair_audit SET actor=\'changed\' WHERE id=?','DELETE FROM public.reconciliation_repair_audit WHERE id=?']) await rejects('row_guards',tx => tx.execute(sql,[committed.id]),'P0001',IMMUTABLE_MESSAGE);
    assertions.update_delete_immutable=true;
    checkpoint('FIXTURE_AUDIT_ROLE_DENIALS');
    for (const sql of ['ALTER TABLE public.reconciliation_repair_audit ADD COLUMN forbidden text','DROP TABLE public.reconciliation_repair_audit','ALTER TABLE public.reconciliation_repair_audit DISABLE TRIGGER reconciliation_repair_audit_immutable',"SET LOCAL session_replication_role = replica"]) await rejects('role_denials',tx => tx.execute(sql),'42501');
    assertions.runtime_ddl_replication_denied=true;
    checkpoint('FIXTURE_AUDIT_TRUNCATE_DENIAL');
    await rejects('role_denials',tx => tx.execute('TRUNCATE TABLE public.reconciliation_repair_audit'),'42501');
    assertions.runtime_truncate_privilege_denied=true;
    checkpoint('FIXTURE_AUDIT_FINAL_ROWS');
    const finalRows=await rows();assert.equal(finalRows.length,3);
    console.log(JSON.stringify({status:'PASS',scope:'native MikroORM/physical PG storage and webhook fixtures; NOT provider or full checkout verification',duplicate:true,atomic_rollback:true,audit:{version:1,status:'PASS',synthetic_storage_only:true,assertions,negative_cases:counts,committed_rows:finalRows.length,schema_sha256:schemaHash,rows_sha256:hash(finalRows),owner_truncate_guard:'pending-harness',migration_down:'not-executed'}}));
  } finally {
    try { if(observerConnection) await observer.em.getConnection().getKnex().client.releaseConnection(observerConnection); }
    finally { try { if(observer) await observer.close(true); } finally { if(orm) await orm.close(true);clearTimeout(deadline); } }
  }
}
module.exports = { AUDIT_COLUMNS,AUDIT_CHECKS,IMMUTABLE_MESSAGE,validateAuditCatalog,pgFailure };
if (require.main === module) main().catch(fixtureFailed);
