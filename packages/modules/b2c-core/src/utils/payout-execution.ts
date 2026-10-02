import { AsyncLocalStorage } from 'node:async_hooks'
import type { Knex } from 'knex'
import type { SettlementStore } from './refund-settlement'

export type PayoutPlan = Readonly<{
  amount: number; currency: string; account_id: string; account_reference_id: string
  source_transaction: string; transaction_id: string
}>
const dispatchPlan = new AsyncLocalStorage<PayoutPlan>()
/** Pin the request across the module's account reload and transaction boundary. */
export function withPayoutDispatchPlan<T>(plan: PayoutPlan, work: () => Promise<T>): Promise<T> {
  return dispatchPlan.run(canonicalPayoutPlan(plan), work)
}
export function currentPayoutDispatchPlan(): PayoutPlan | undefined { return dispatchPlan.getStore() }

export type PayoutExecution = {
  order_id: string; scope_id: string; plan: PayoutPlan; phase: 'started' | 'completed'
  payout_id: string | null; transfer_id: string | null
}
export interface PayoutExecutionStore {
  get(orderId: string): Promise<PayoutExecution | null>
  assertScopeResolved(scopeId: string): Promise<void>
  start(row: PayoutExecution): Promise<void>
  complete(orderId: string, scopeId: string, payoutId: string | null, transferId: string | null): Promise<void>
}
const identity = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v)
export function canonicalPayoutPlan(value: PayoutPlan): PayoutPlan {
  const { amount, currency, account_id, account_reference_id, source_transaction, transaction_id } = value
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER || !/^[a-z]{3}$/.test(currency) ||
      ![account_id, account_reference_id, source_transaction, transaction_id].every(identity)) throw new Error('Invalid payout plan')
  return Object.freeze({ amount, currency, account_id, account_reference_id, source_transaction, transaction_id })
}
/** Root Knex only. Short ledger-only transactions force durable commit BEFORE
 * dispatch; never share the module's money transaction or compensate these rows. */
export function createPostgresPayoutExecutionStore(knex: Knex): PayoutExecutionStore {
  if (!knex || knex.isTransaction || knex.client?.transacting) throw new Error('Root database connection required')
  const durable = async (work: (tx: Knex.Transaction) => Promise<void>) => knex.transaction(async tx => {
    await tx.raw('SET LOCAL synchronous_commit = on')
    await work(tx)
  })
  return {
    async get(orderId) {
      const row = await knex('payout_execution').where({ order_id: orderId }).first()
      return row ? { ...row, plan: canonicalPayoutPlan(typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan) } : null
    },
    async assertScopeResolved(scopeId) {
      if (await knex('payout_execution').where({ scope_id: scopeId, phase: 'started' }).first()) {
        throw new Error('Unresolved payout execution requires reconciliation')
      }
    },
    async start(row) {
      await durable(async tx => { await tx('payout_execution').insert({ ...row, plan: JSON.stringify(canonicalPayoutPlan(row.plan)) }) })
    },
    async complete(orderId, scopeId, payoutId, transferId) {
      await durable(async tx => {
        const changed = await tx('payout_execution').where({ order_id: orderId, scope_id: scopeId, phase: 'started' })
          .update({ phase: 'completed', payout_id: payoutId, transfer_id: transferId })
        if (changed !== 1) throw new Error('Payout checkpoint conflict')
      })
    },
  }
}
/** Unknown started outcomes NEVER redispatch, even if the provider key expires. */
export async function executePayout(locks: SettlementStore, store: PayoutExecutionStore,
  input: { order_id: string; scope_id: string }, callbacks: {
    plan(): Promise<PayoutPlan>
    transfer(plan: PayoutPlan): Promise<{ payout_id: string; transfer_id: string }>
    link(payoutId: string): Promise<void>
    verify(row: PayoutExecution): Promise<void>
  }): Promise<PayoutExecution> {
  if (![input.order_id, input.scope_id].every(identity)) throw new Error('Invalid payout identity')
  // Copy before the first await/lock: queued callers must not change the scope,
  // operation or effect implementation after validation.
  input = Object.freeze({ order_id: input.order_id, scope_id: input.scope_id })
  callbacks = Object.freeze({ plan: callbacks.plan, transfer: callbacks.transfer, link: callbacks.link, verify: callbacks.verify })
  if (Object.values(callbacks).some(value => typeof value !== 'function')) throw new Error('Invalid payout callbacks')
  return locks.withScopeLock(input.scope_id, async session => {
    // Empty ID is forbidden by the refund store. A fixed sentinel alone could
    // collide with an operation ID, so also check that exact operation globally.
    if (await session.findUnfinished(input.order_id)) throw new Error('Unfinished refund blocks payout')
    const sameId = await session.getOperation(input.order_id)
    if (sameId && sameId.input.scope_id === input.scope_id && sameId.phase !== 'completed') throw new Error('Unfinished refund blocks payout')
    await store.assertScopeResolved(input.scope_id)
    const existing = await store.get(input.order_id)
    if (existing) {
      if (existing.scope_id !== input.scope_id || existing.phase !== 'completed') throw new Error('Unresolved payout execution')
      await callbacks.verify(existing)
      return existing
    }
    const plan = canonicalPayoutPlan(await callbacks.plan())
    if (plan.transaction_id !== input.order_id) throw new Error('Payout transaction mismatch')
    const row: PayoutExecution = { ...input, plan, phase: 'started', payout_id: null, transfer_id: null }
    await store.start(row)
    if (plan.amount > 0) {
      const result = await callbacks.transfer(plan)
      if (!identity(result.payout_id) || !identity(result.transfer_id)) throw new Error('Invalid payout receipt')
      row.payout_id = result.payout_id; row.transfer_id = result.transfer_id
      await callbacks.link(result.payout_id)
    }
    // Verify the actual committed ledger + exact raw link before completion.
    await callbacks.verify(row)
    await store.complete(row.order_id, row.scope_id, row.payout_id, row.transfer_id)
    return { ...row, phase: 'completed' }
  })
}
