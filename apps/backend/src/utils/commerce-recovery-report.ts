/** Inspection only: ledger phases are checkpoints, never proof of money success/absence. */
const PHASES = {
  refund_settlement: ['pending', 'refund_started', 'refund_completed', 'reversal_started', 'completed'],
  native_return_execution: ['pending', 'begin_started', 'begun', 'items_started', 'items_done', 'confirm_started', 'confirmed'],
  payout_execution: ['started', 'completed'],
} as const

type RecoveryType = keyof typeof PHASES
export class RecoveryFilterError extends Error {
  constructor() { super('Invalid recovery inspection filters.') }
}
export class RecoveryUnavailableError extends Error {
  constructor() { super('Recovery inspection unavailable.') }
}
type Filters = { limit: number; offset: number; type?: RecoveryType; phase?: string; order_id?: string }
type ReadDatabase = { raw(sql: string, bindings: (string | number)[]): PromiseLike<{ rows: Record<string, unknown>[] }> }
const owns = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v)

export function parseRecoveryFilters(query: unknown): Filters {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new RecoveryFilterError()
  const q = query as Record<string, unknown>
  if (Object.keys(q).some(k => !['limit', 'offset', 'type', 'phase', 'order_id'].includes(k))) throw new RecoveryFilterError()
  function integer(key: string, fallback: number, min: number, max: number) {
    if (!owns(q, key)) return fallback
    const v = q[key]
    if (typeof v !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v) || v.length > 5 || Number(v) < min || Number(v) > max) throw new RecoveryFilterError()
    return Number(v)
  }
  const result: Filters = { limit: integer('limit', 25, 1, 50), offset: integer('offset', 0, 0, 10000) }
  if (owns(q, 'type')) {
    if (typeof q.type !== 'string' || !owns(PHASES, q.type)) throw new RecoveryFilterError()
    result.type = q.type as RecoveryType
  }
  if (owns(q, 'phase')) {
    const phases: readonly string[] = result.type ? PHASES[result.type] : Object.values(PHASES).flat()
    if (typeof q.phase !== 'string' || !phases.includes(q.phase)) throw new RecoveryFilterError()
    result.phase = q.phase
  }
  if (owns(q, 'order_id')) {
    if (!validId(q.order_id)) throw new RecoveryFilterError()
    result.order_id = q.order_id
  }
  return result
}

function timestamp(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== 'string') throw new RecoveryUnavailableError()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new RecoveryUnavailableError()
  return date.toISOString()
}
function project(row: Record<string, unknown>) {
  const type = row.type
  if (typeof type !== 'string' || !owns(PHASES, type) || typeof row.phase !== 'string' || !(PHASES[type as RecoveryType] as readonly string[]).includes(row.phase)) throw new RecoveryUnavailableError()
  if (!validId(row.order_id) || !validId(type !== 'native_return_execution' ? row.operation_id : row.request_id)) throw new RecoveryUnavailableError()
  const terminal = row.phase === 'completed' || row.phase === 'confirmed'
  return {
    type,
    operation_id: type !== 'native_return_execution' ? row.operation_id : null,
    request_id: type === 'native_return_execution' ? row.request_id : null,
    order_id: row.order_id,
    phase: row.phase,
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    action_classification: row.phase === 'started' || row.phase.endsWith('_started') ? 'manual_reconciliation_required' : terminal ? 'recorded_terminal_verify_evidence' : 'inspect_before_any_resume',
    evidence_required: type === 'refund_settlement'
      ? ['customer_refund_and_accounting_proof', 'seller_reversal_or_zero_obligation_proof', 'immutable_operation_plan_identity_proof']
      : type === 'payout_execution'
        ? ['provider_transfer_and_local_payout_proof', 'immutable_plan_amount_currency_destination_proof', 'raw_order_payout_linkage_proof']
        : ['native_identity_action_item_proof', 'frozen_request_plan_match_proof', 'native_confirmation_state_proof'],
  }
}

/** Exactly one parameterized SELECT; no locks, writes, providers, raw plans or repair authorization. */
export async function readCommerceRecoveryReport(db: ReadDatabase, query: unknown) {
  const filters = parseRecoveryFilters(query)
  const clauses: string[] = []
  const bindings: (string | number)[] = []
  // Only hard-coded identifiers enter SQL; every caller value is a binding.
  if (filters.type !== undefined) { clauses.push('type = ?'); bindings.push(filters.type) }
  if (filters.phase !== undefined) { clauses.push('phase = ?'); bindings.push(filters.phase) }
  if (filters.order_id !== undefined) { clauses.push('order_id = ?'); bindings.push(filters.order_id) }
  const sql = `SELECT type, operation_id, request_id, order_id, phase, created_at, updated_at
    FROM (
      SELECT 'refund_settlement'::text AS type, operation_id, NULL::text AS request_id, order_id, phase, created_at, updated_at FROM refund_settlement
      UNION ALL
      SELECT 'native_return_execution'::text AS type, NULL::text AS operation_id, request_id, order_id, phase, created_at, updated_at FROM native_return_execution
      UNION ALL
      SELECT 'payout_execution'::text AS type, order_id AS operation_id, NULL::text AS request_id, order_id, phase, created_at, updated_at FROM payout_execution
    ) AS recovery_records
    ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
    ORDER BY created_at ASC, type ASC, operation_id ASC NULLS LAST, request_id ASC NULLS LAST
    LIMIT ? OFFSET ?`
  bindings.push(filters.limit + 1, filters.offset)
  try {
    const result = await db.raw(sql, bindings)
    if (!Array.isArray(result?.rows)) throw new RecoveryUnavailableError()
    const hasMore = result.rows.length > filters.limit
    const boundReached = hasMore && filters.offset + filters.limit > 10000
    return {
      items: result.rows.slice(0, filters.limit).map(project),
      limit: filters.limit, offset: filters.offset,
      has_more: hasMore,
      next_offset: hasMore && !boundReached ? filters.offset + filters.limit : null,
      pagination_bound_reached: boundReached,
      read_only: true,
      money_repair_authorized: false,
      limitations: 'GET inspection does not authorize money repair, retry or completion. Recorded phases and empty results are not proof of refund success or absence. Independent evidence and a separately authorized reconciliation process are required.',
    }
  } catch { throw new RecoveryUnavailableError() }
}
