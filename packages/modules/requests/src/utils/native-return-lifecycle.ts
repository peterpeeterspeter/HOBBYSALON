import { createHash } from 'node:crypto'

export type NativeReturnPlan = {
  request_id: string
  order_id: string
  location_id: string | null
  items: { id: string; quantity: number; reason_id: string | null }[]
}
export type NativeReturnIdentity = { return_id: string; order_change_id: string }
export type NativeReturnPhase = 'pending' | 'begin_started' | 'begun' | 'items_started' | 'items_done' | 'confirm_started' | 'confirmed'
export type NativeReturnRecord = {
  plan: NativeReturnPlan
  fingerprint: string
  identity: NativeReturnIdentity | null
  phase: NativeReturnPhase
}
/** Methods execute on the same locked physical connection; writes commit before resolving. */
export interface NativeReturnSession {
  getRequest(requestId: string): Promise<NativeReturnRecord | null>
  findUnfinished(exceptRequestId: string): Promise<NativeReturnRecord | null>
  create(record: NativeReturnRecord): Promise<void>
  transition(requestId: string, expected: NativeReturnPhase, next: NativeReturnPhase, identity?: NativeReturnIdentity | null): Promise<void>
}
export interface NativeReturnStore {
  withOrderLock<T>(orderId: string, work: (session: NativeReturnSession) => Promise<T>): Promise<T>
}
export interface NativeReturnEffects {
  begin(plan: NativeReturnPlan, fingerprint: string): Promise<NativeReturnIdentity>
  items(plan: NativeReturnPlan, identity: NativeReturnIdentity): Promise<void>
  confirm(plan: NativeReturnPlan, identity: NativeReturnIdentity): Promise<void>
  /** Read-only native identity/state check. Required on replay and before each remaining mutation. */
  verify(plan: NativeReturnPlan, identity: NativeReturnIdentity, phase: 'begun' | 'items_done' | 'confirmed'): Promise<void>
}
export type NativeReturnErrorCode = 'invalid_input' | 'fingerprint_mismatch' | 'reconciliation_required' | 'order_blocked' | 'lock_unavailable' | 'storage_failure' | 'native_failure' | 'verification_failure'
export class NativeReturnError extends Error {
  readonly code: NativeReturnErrorCode
  constructor(code: NativeReturnErrorCode) { super(`Native return: ${code}`); this.name = 'NativeReturnError'; this.code = code }
}
export function validNativeReturnId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}
export function freezeNativeReturnPlan(input: NativeReturnPlan): NativeReturnPlan {
  if (!input || !validNativeReturnId(input.request_id) || !validNativeReturnId(input.order_id) ||
      (input.location_id !== null && !validNativeReturnId(input.location_id)) || !Array.isArray(input.items) || !input.items.length) throw new NativeReturnError('invalid_input')
  const seen = new Set<string>()
  const items = input.items.map(item => {
    if (!item || !validNativeReturnId(item.id) || seen.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
        (item.reason_id !== null && !validNativeReturnId(item.reason_id))) throw new NativeReturnError('invalid_input')
    seen.add(item.id)
    return Object.freeze({ id: item.id, quantity: item.quantity, reason_id: item.reason_id })
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1: 0)
  Object.freeze(items)
  return Object.freeze({ request_id: input.request_id, order_id: input.order_id, location_id: input.location_id, items })
}
export function fingerprintNativeReturnPlan(plan: NativeReturnPlan): string {
  return createHash('sha256').update(JSON.stringify(freezeNativeReturnPlan(plan))).digest('hex')
}
function frozenIdentity(value: NativeReturnIdentity | null): NativeReturnIdentity {
  if (!value || !validNativeReturnId(value.return_id) || !validNativeReturnId(value.order_change_id)) throw new NativeReturnError('reconciliation_required')
  return Object.freeze({ return_id: value.return_id, order_change_id: value.order_change_id })
}

/** No retries of uncertain outcomes, compensation, native calls, or ambient database transactions. */
export async function executeNativeReturn(store: NativeReturnStore, input: NativeReturnPlan, effects: NativeReturnEffects): Promise<{ identity: NativeReturnIdentity; plan: NativeReturnPlan }> {
  try {
    const requested = freezeNativeReturnPlan(input), fingerprint = fingerprintNativeReturnPlan(requested)
    if (!store || typeof store.withOrderLock !== 'function' || !effects ||
        !['begin', 'items', 'confirm', 'verify'].every(key => typeof (effects as any)[key] === 'function')) throw new NativeReturnError('invalid_input')
    return await store.withOrderLock(requested.order_id, async session => {
      let record = await session.getRequest(requested.request_id)
      if (record && record.fingerprint !== fingerprint) throw new NativeReturnError('fingerprint_mismatch')
      if (record && (record.plan.request_id !== requested.request_id || record.plan.order_id !== requested.order_id || fingerprintNativeReturnPlan(record.plan) !== record.fingerprint)) throw new NativeReturnError('reconciliation_required')
      if (await session.findUnfinished(requested.request_id)) {
        // A historical confirmed replay must not be blocked by a newer request on the same order.
        if (record?.phase !== 'confirmed') throw new NativeReturnError('order_blocked')
      }
      if (!record) {
        record = { plan: requested, fingerprint, phase: 'pending', identity: null }
        await session.create(record)
      }
      const plan = freezeNativeReturnPlan(record.plan)
      let phase = record.phase, identity = record.identity ? frozenIdentity(record.identity) : null
      if (!['pending', 'begun', 'items_done', 'confirmed'].includes(phase) ||
          (phase === 'pending' ? identity !== null : identity === null)) throw new NativeReturnError('reconciliation_required')
      const move = async (next: NativeReturnPhase, ids: NativeReturnIdentity | null = null) => {
        await session.transition(plan.request_id, phase, next, ids); phase = next
      }
      const verify = async (at: 'begun' | 'items_done' | 'confirmed') => {
        try { await effects.verify(plan, identity!, at) } catch { throw new NativeReturnError('verification_failure') }
      }
      if (phase === 'pending') {
        await move('begin_started')
        try { identity = frozenIdentity(await effects.begin(plan, fingerprint)) } catch { throw new NativeReturnError('native_failure') }
        await move('begun', identity)
      }
      if (phase === 'begun') {
        await verify('begun'); await move('items_started')
        try { await effects.items(plan, identity!) } catch { throw new NativeReturnError('native_failure') }
        await move('items_done')
      }
      if (phase === 'items_done') {
        await verify('items_done'); await move('confirm_started')
        try { await effects.confirm(plan, identity!) } catch { throw new NativeReturnError('native_failure') }
        await verify('confirmed'); await move('confirmed')
      } else if (phase === 'confirmed') await verify('confirmed')
      return Object.freeze({ identity: identity!, plan })
    })
  } catch (error) {
    throw new NativeReturnError(error instanceof NativeReturnError ? error.code : 'storage_failure')
  }
}
