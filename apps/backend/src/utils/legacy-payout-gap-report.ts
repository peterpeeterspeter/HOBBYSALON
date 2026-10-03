/** Read-only gap list. A row means the new ledger cannot account for an older payout link. */
export class LegacyPayoutGapError extends Error {
  constructor() { super('Invalid legacy payout gap filters.') }
}
export class LegacyPayoutGapUnavailableError extends Error {
  constructor() { super('Legacy payout gap inspection unavailable.') }
}

type Filters = { limit: number; offset: number; order_id?: string }
type ReadDatabase = { raw(sql: string, bindings: (string | number)[]): PromiseLike<{ rows: Record<string, unknown>[] }> }
const owns = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v)

export function parseLegacyPayoutGapFilters(query: unknown): Filters {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new LegacyPayoutGapError()
  const q = query as Record<string, unknown>
  if (Object.keys(q).some(k => !['limit', 'offset', 'order_id'].includes(k))) throw new LegacyPayoutGapError()
  function integer(key: string, fallback: number, min: number, max: number) {
    if (!owns(q, key)) return fallback
    const v = q[key]
    if (typeof v !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v) || v.length > 5 || Number(v) < min || Number(v) > max) throw new LegacyPayoutGapError()
    return Number(v)
  }
  const result: Filters = { limit: integer('limit', 25, 1, 50), offset: integer('offset', 0, 0, 10000) }
  if (owns(q, 'order_id')) {
    if (!validId(q.order_id)) throw new LegacyPayoutGapError()
    result.order_id = q.order_id
  }
  return result
}

function project(row: Record<string, unknown>) {
  if (row.gap_kind !== 'linked_payout_without_execution' && row.gap_kind !== 'payout_without_order_link') {
    throw new LegacyPayoutGapUnavailableError()
  }
  if (!validId(row.payout_id)) throw new LegacyPayoutGapUnavailableError()
  if (row.gap_kind === 'linked_payout_without_execution' && !validId(row.order_id)) throw new LegacyPayoutGapUnavailableError()
  if (row.gap_kind === 'payout_without_order_link' && row.order_id != null) throw new LegacyPayoutGapUnavailableError()
  return {
    gap_kind: row.gap_kind,
    order_id: row.gap_kind === 'linked_payout_without_execution' ? row.order_id : null,
    payout_id: row.payout_id,
    action_classification: 'historical_transfer_without_ledger' as const,
    evidence_required: [
      'stripe_transfer_or_explicit_zero_proof',
      'local_payout_row_proof',
      'order_link_or_documented_unlink_proof',
    ],
  }
}

/**
 * One parameterized SELECT. Does not write, lock, or call Stripe.
 * Empty results do not prove that no historical transfer exists outside these tables.
 */
export async function readLegacyPayoutGapReport(db: ReadDatabase, query: unknown) {
  const filters = parseLegacyPayoutGapFilters(query)
  const bindings: (string | number)[] = []
  const orderFilter = filters.order_id !== undefined
    ? (bindings.push(filters.order_id), 'AND op.order_id = ?')
    : ''
  const sql = `SELECT gap_kind, order_id, payout_id
    FROM (
      SELECT 'linked_payout_without_execution'::text AS gap_kind, op.order_id, op.payout_id
      FROM order_payout op
      LEFT JOIN payout_execution pe ON pe.order_id = op.order_id
      WHERE pe.order_id IS NULL
        AND op.deleted_at IS NULL
        ${orderFilter}
      UNION ALL
      SELECT 'payout_without_order_link'::text, NULL::text, p.id
      FROM payout p
      LEFT JOIN order_payout op ON op.payout_id = p.id AND op.deleted_at IS NULL
      WHERE op.payout_id IS NULL
        AND p.deleted_at IS NULL
        ${filters.order_id !== undefined ? 'AND false' : ''}
    ) AS legacy_payout_gaps
    ORDER BY gap_kind ASC, order_id ASC NULLS LAST, payout_id ASC
    LIMIT ? OFFSET ?`
  bindings.push(filters.limit + 1, filters.offset)
  try {
    const result = await db.raw(sql, bindings)
    if (!Array.isArray(result?.rows)) throw new LegacyPayoutGapUnavailableError()
    const hasMore = result.rows.length > filters.limit
    const boundReached = hasMore && filters.offset + filters.limit > 10000
    return {
      items: result.rows.slice(0, filters.limit).map(project),
      limit: filters.limit,
      offset: filters.offset,
      has_more: hasMore,
      next_offset: hasMore && !boundReached ? filters.offset + filters.limit : null,
      pagination_bound_reached: boundReached,
      read_only: true,
      money_repair_authorized: false,
      limitations: 'This list is not proof that every historical Stripe transfer is absent or present. Rows only show local payout links the payout_execution ledger does not cover. No repair, retry, or completion is authorized.',
    }
  } catch (error) {
    if (error instanceof LegacyPayoutGapUnavailableError) throw error
    throw new LegacyPayoutGapUnavailableError()
  }
}
