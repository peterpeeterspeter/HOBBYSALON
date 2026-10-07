'use strict';
// Real PostgreSQL + compiled candidate transaction kernel. DB integration fixture;
// not provider verification, not full checkout/order completion acceptance.
const assert = require('node:assert/strict');
const { MikroORM } = require('/app/node_modules/@mikro-orm/postgresql');
const { applyMarketplaceWebhookTransaction, readCommittedMarketplaceWebhookReceipt } = require('/app/apps/backend/.medusa/server/src/utils/marketplace-webhook-transaction.js');
(async () => {
  const orm = await MikroORM.init({ entities: [], discovery: { warnWhenNoEntities: false }, clientUrl: process.env.DATABASE_URL, schema: 'public' });
  try {
    const em = orm.em.fork();
    await assert.rejects(em.execute('CREATE TABLE forbidden_runtime_ddl(id text)'), /permission denied/);
    await assert.rejects(em.execute('CREATE TEMP TABLE forbidden_runtime_temp(id text)'), /permission denied/);
    await assert.rejects(em.execute('ALTER TABLE ci_acceptance_sentinel ADD COLUMN forbidden text'), /must be owner|permission denied/);
    const identity = n => ({ event_id: `evt_ci_fixture_${n}`, provider_id: 'integration-fixture', action: 'successful', data: { cart_id: 'cart_ci_fixture', session_id: 'ps_ci_fixture', payment_collection_id: 'paycol_ci_fixture', payment_intent_id: 'pi_ci_fixture', amount: '100', currency_code: 'eur' } });
    const input = identity('durable');
    const first = await applyMarketplaceWebhookTransaction(em, input, async scope => {
      await scope.execute("INSERT INTO ci_acceptance_sentinel(id,payload) VALUES ('business_fixture', '{\"source\":\"integration-fixture\"}')");
      return 'committed';
    });
    assert.equal(first.duplicate, false);
    assert.equal(await readCommittedMarketplaceWebhookReceipt(em, input), true);
    const duplicate = await applyMarketplaceWebhookTransaction(em, input, async () => { throw new Error('duplicate side effect'); });
    assert.equal(duplicate.duplicate, true);
    let rollbackBarrierReached = false;
    await assert.rejects(applyMarketplaceWebhookTransaction(em, identity('aborted'), async scope => {
      await scope.execute("INSERT INTO ci_acceptance_sentinel(id,payload) VALUES ('aborted_fixture','{}')");
      rollbackBarrierReached = true;
      throw new Error('intentional fixture rollback');
    }), { message: 'intentional fixture rollback' });
    assert.equal(rollbackBarrierReached, true, 'intentional rollback write barrier must be reached');
    assert.equal(await readCommittedMarketplaceWebhookReceipt(em, identity('aborted')), false);
    assert.equal((await em.execute("SELECT id FROM ci_acceptance_sentinel WHERE id='aborted_fixture'")).length, 0);
    console.log(JSON.stringify({ status: 'PASS', scope: 'native MikroORM/physical PG transaction integration fixtures; NOT Stripe or full checkout verification', duplicate: true, atomic_rollback: true }));
  } finally { await orm.close(true); }
})().catch(() => { console.error('FIXTURE_FAILED'); process.exitCode = 1; });
