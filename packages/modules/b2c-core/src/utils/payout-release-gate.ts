/**
 * Seller transfers stay off until an operator sets COMMERCE_PAYOUTS_ENABLED=true
 * and the local payout tables show no rows the execution ledger does not cover.
 * An empty gap query is not proof that every historical Stripe transfer exists here.
 */
export function areSellerPayoutsReleased(): boolean {
  return process.env.COMMERCE_PAYOUTS_ENABLED?.trim().toLowerCase() === 'true'
}

export const LEGACY_PAYOUT_GAP_EXISTS_SQL = `SELECT 1 AS gap
  FROM (
    SELECT op.payout_id
    FROM order_payout op
    LEFT JOIN payout_execution pe ON pe.order_id = op.order_id
    WHERE pe.order_id IS NULL
      AND op.deleted_at IS NULL
    UNION ALL
    SELECT p.id
    FROM payout p
    LEFT JOIN order_payout op ON op.payout_id = p.id AND op.deleted_at IS NULL
    WHERE op.payout_id IS NULL
      AND p.deleted_at IS NULL
  ) AS legacy_payout_gaps
  LIMIT 1`

type GapReader = { raw(sql: string): PromiseLike<{ rows?: unknown[] }> }

export async function assertSellerPayoutsReleased(db: GapReader): Promise<void> {
  if (!areSellerPayoutsReleased()) {
    throw new Error('Seller payouts are not released')
  }
  let result: { rows?: unknown[] }
  try {
    result = await db.raw(LEGACY_PAYOUT_GAP_EXISTS_SQL)
  } catch {
    throw new Error('Legacy payout inspection unavailable')
  }
  if (!Array.isArray(result?.rows)) {
    throw new Error('Legacy payout inspection unavailable')
  }
  if (result.rows.length > 0) {
    throw new Error('Legacy payouts are not covered by the execution ledger')
  }
}
