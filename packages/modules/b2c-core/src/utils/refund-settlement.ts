/** Fixed major-unit amounts and pinned business identities, computed only under the scope lock. */
export type SettlementPlan = {
  order_id: string
  operation_id: string
  scope_id: string
  payment_id: string | null
  split_order_payment_id: string | null
  payout_id: string | null
  currency_code: string
  customerRefund: number
  sellerReversal: number
}

export type SettlementInput = {
  operation_id: string
  order_id: string
  scope_id: string
  fingerprint: string
}
export type SettlementPhase = 'pending' | 'refund_started' | 'refund_completed' | 'reversal_started' | 'completed'
export type SettlementRecord = {
  input: Readonly<SettlementInput>
  plan: Readonly<SettlementPlan>
  phase: SettlementPhase
  reversal_receipt_id: string | null
}
export type SettlementReceipt = Readonly<SettlementInput & {
  phase: SettlementPhase
  reversal_receipt_id: string | null
}>
export type SettlementResult = Readonly<{ plan: Readonly<SettlementPlan>; receipt: SettlementReceipt }>

/** All methods operate on the same locked scope and in autocommit (never an ambient transaction).
 * create must reject duplicate operation IDs; transition must compare-and-swap the expected phase.
 * Neither method may modify the original input/plan, and must resolve only after durable commit.
 * findUnfinished excludes the supplied operation ID and returns any non-completed row in this scope.
 */
export interface SettlementSession {
  getOperation(operationId: string): Promise<SettlementRecord | null>
  findUnfinished(exceptOperationId: string): Promise<SettlementRecord | null>
  create(record: SettlementRecord): Promise<void>
  transition(operationId: string, expected: SettlementPhase, next: SettlementPhase, reversalReceiptId?: string | null): Promise<void>
}
export interface SettlementStore {
  /** Exclusive across processes, not a process-local mutex. Failure to lock must reject before work. */
  withScopeLock<T>(scopeId: string, work: (session: SettlementSession) => Promise<T>): Promise<T>
}
export type SettlementEffects = {
  plan: () => Promise<SettlementPlan>
  refund: (plan: Readonly<SettlementPlan>) => Promise<unknown>
  reverse: (plan: Readonly<SettlementPlan>) => Promise<unknown>
  recoverReversal?: (plan: Readonly<SettlementPlan>) => Promise<unknown | null>
}
export type SettlementErrorCode = 'invalid_input' | 'identity_conflict' | 'scope_blocked' | 'lock_unavailable' | 'storage_failure' | 'plan_failed' | 'reconciliation_required'
/** Stable, sanitized error codes. Never attach provider/DB errors, request data, or their causes. */
export class SettlementError extends Error {
  readonly code: SettlementErrorCode
  constructor(code: SettlementErrorCode) {
    super(`Settlement ${code}`)
    this.name = 'SettlementError'
    this.code = code
  }
}

function result(record: SettlementRecord): SettlementResult {
  return Object.freeze({
    plan: Object.freeze({ ...record.plan }),
    receipt: Object.freeze({ ...record.input, phase: record.phase, reversal_receipt_id: record.reversal_receipt_id }),
  })
}

/** Read-only proof returned by recoverReversal, NOT a provider search/retry instruction.
 * The adapter must read an already-saved, validated local reversal (including provider success),
 * map its stable business operation and actual amount to these fields, or return null.
 * No inference of external absence, TTL retry, or compensating provider call is permitted.
 * Arbitrary callback results are not persisted, to avoid storing provider credentials/PII.
 */
export type ReversalRecoveryEvidence = {
  operation_id: string
  payout_id: string
  currency_code: string
  amount: number
  receipt_id: string
}

const phases: SettlementPhase[] = ['pending', 'refund_started', 'refund_completed', 'reversal_started', 'completed']
function validString(value: unknown, maximum = 255): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettlementError('invalid_input')
  return value as Record<string, unknown>
}
function snapshotInput(value: unknown): Readonly<SettlementInput> {
  const v = object(value)
  if (!validString(v.operation_id) || !validString(v.order_id) || !validString(v.scope_id) || !validString(v.fingerprint, 4096)) {
    throw new SettlementError('invalid_input')
  }
  return Object.freeze({ operation_id: v.operation_id, order_id: v.order_id, scope_id: v.scope_id, fingerprint: v.fingerprint })
}
function snapshotPlan(value: unknown, input: Readonly<SettlementInput>): Readonly<SettlementPlan> {
  const v = object(value)
  const nullableId = (id: unknown) => id === null || validString(id)
  const amount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER
  if (v.operation_id !== input.operation_id || v.order_id !== input.order_id || v.scope_id !== input.scope_id ||
      !nullableId(v.payment_id) || !nullableId(v.split_order_payment_id) || !nullableId(v.payout_id) ||
      typeof v.currency_code !== 'string' || !/^[a-z]{3}$/.test(v.currency_code) ||
      !amount(v.customerRefund) || !amount(v.sellerReversal) ||
      (v.customerRefund > 0 && v.payment_id === null) || (v.sellerReversal > 0 && v.payout_id === null)) {
    throw new SettlementError('invalid_input')
  }
  // Explicit scalar whitelist, not spreading potentially nested callback/user data.
  return Object.freeze({
    order_id: input.order_id, operation_id: input.operation_id, scope_id: input.scope_id,
    payment_id: v.payment_id as string | null, split_order_payment_id: v.split_order_payment_id as string | null,
    payout_id: v.payout_id as string | null, currency_code: v.currency_code,
    customerRefund: v.customerRefund, sellerReversal: v.sellerReversal,
  })
}
function snapshotRecord(value: SettlementRecord): SettlementRecord {
  try {
    const input = snapshotInput(value.input), plan = snapshotPlan(value.plan, input)
    if (!phases.includes(value.phase) || (value.reversal_receipt_id !== null && !validString(value.reversal_receipt_id))) {
      throw new Error()
    }
    return { input, plan, phase: value.phase, reversal_receipt_id: value.reversal_receipt_id }
  } catch { throw new SettlementError('storage_failure') }
}
function assertEffectSucceeded(value: unknown): void {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (v.err || v.error || (Array.isArray(v.errors) && v.errors.length > 0)) throw new Error()
  }
}
function recoveryReceipt(value: unknown, plan: Readonly<SettlementPlan>): string {
  const v = object(value)
  if (plan.sellerReversal <= 0 || v.operation_id !== plan.operation_id || v.payout_id !== plan.payout_id ||
      v.currency_code !== plan.currency_code || v.amount !== plan.sellerReversal || !validString(v.receipt_id)) {
    throw new Error()
  }
  assertEffectSucceeded(value)
  return v.receipt_id
}

/** Financial settlement only; native workflow bookkeeping remains the adapters' responsibility.
 * The adapters MUST reject on provider/workflow failure (including nested workflow errors).
 * Started legs have unknown outcomes until proven complete; this engine never retries them.
 * Caller must supply a stable business operation ID and canonical fingerprint, not an amount key.
 * No cancellation/return-status/fulfillment side effects belong in the planning callback.
 */
export async function executeSettlement(store: SettlementStore, input: SettlementInput, effects: SettlementEffects): Promise<SettlementResult> {
  let request: Readonly<SettlementInput>
  let callbacks: SettlementEffects
  try {
    request = snapshotInput(input)
    callbacks = { plan: effects.plan, refund: effects.refund, reverse: effects.reverse, recoverReversal: effects.recoverReversal }
    if (typeof callbacks.plan !== 'function' || typeof callbacks.refund !== 'function' || typeof callbacks.reverse !== 'function' ||
        (callbacks.recoverReversal !== undefined && typeof callbacks.recoverReversal !== 'function')) throw new Error()
  } catch { throw new SettlementError('invalid_input') }
  try {
    return await store.withScopeLock(request.scope_id, async session => {
      const saved = await session.getOperation(request.operation_id)
      let record: SettlementRecord
      if (saved) {
        record = snapshotRecord(saved)
        if (Object.keys(request).some(key => request[key as keyof SettlementInput] !== record.input[key as keyof SettlementInput])) {
          throw new SettlementError('identity_conflict')
        }
        if (record.phase === 'completed') return result(record)
        if (await session.findUnfinished(request.operation_id)) throw new SettlementError('scope_blocked')
      } else {
        if (await session.findUnfinished(request.operation_id)) throw new SettlementError('scope_blocked')
        let planned: SettlementPlan
        try { planned = await callbacks.plan() } catch { throw new SettlementError('plan_failed') }
        record = { input: request, plan: snapshotPlan(planned, request), phase: 'pending', reversal_receipt_id: null }
        await session.create(record)
      }
      const advance = async (next: SettlementPhase, receiptId: string | null = null) => {
        await session.transition(request.operation_id, record.phase, next, receiptId)
        record.phase = next
        record.reversal_receipt_id = receiptId
      }
      if (record.phase === 'refund_started') throw new SettlementError('reconciliation_required')
      if (record.phase === 'reversal_started') {
        let receiptId: string
        try {
          if (!callbacks.recoverReversal) throw new Error()
          receiptId = recoveryReceipt(await callbacks.recoverReversal(record.plan), record.plan)
        } catch { throw new SettlementError('reconciliation_required') }
        await advance('completed', receiptId)
        return result(record)
      }
      if (record.phase === 'pending') {
        if (record.plan.customerRefund > 0) {
          await advance('refund_started')
          try { assertEffectSucceeded(await callbacks.refund(record.plan)) }
          catch { throw new SettlementError('reconciliation_required') }
        }
        await advance('refund_completed')
      }
      let reversalReceiptId: string | null = null
      if (record.plan.sellerReversal > 0) {
        await advance('reversal_started')
        try {
          const receipt = await callbacks.reverse(record.plan)
          assertEffectSucceeded(receipt)
          reversalReceiptId = recoveryReceipt(receipt, record.plan)
        }
        catch { throw new SettlementError('reconciliation_required') }
      }
      await advance('completed', reversalReceiptId)
      return result(record)
    })
  } catch (error) {
    // Discard original messages/causes even for a caller-provided store throwing our error class.
    throw new SettlementError(error instanceof SettlementError ? error.code : 'storage_failure')
  }
}
