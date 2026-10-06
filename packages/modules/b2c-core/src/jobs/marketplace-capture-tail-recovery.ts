import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { withCommerceCartLock, commerceCartLockQuery } from '../utils/commerce-cart-lock'
import { captureMarketplacePaymentUnderLock } from '../utils/marketplace-capture'

/** Bounded durable-tail recovery, not payment recovery. Uncaptured/uncertain
 * payments remain reconciliation-only; never blind capture, authorize or refund.
 * Multiple workers select the same candidates safely: shared cart lock + reread.
 */
export default async function marketplaceCaptureTailJob(container: MedusaContainer) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { rows } = await pg.raw(`SELECT payment_id, cart_id FROM marketplace_capture_tail
    WHERE completed_at IS NULL AND (last_attempt_at IS NULL OR last_attempt_at < now() - interval '5 minutes')
    ORDER BY last_attempt_at NULLS FIRST, created_at LIMIT 20`)
  for (const candidate of rows) {
    try {
      await withCommerceCartLock(container, candidate.cart_id, async () => {
        const query = (sql: string, bindings: any[] = []) => commerceCartLockQuery(container, candidate.cart_id, sql, bindings)
        const selected = (await query(`UPDATE marketplace_capture_tail
          SET last_attempt_at = now(), attempts = attempts + 1, last_error = NULL, updated_at = now()
          WHERE payment_id = ? AND cart_id = ? AND completed_at IS NULL
          AND (last_attempt_at IS NULL OR last_attempt_at < now() - interval '5 minutes') RETURNING snapshot`,
        [candidate.payment_id, candidate.cart_id])).rows
        if (selected.length !== 1) return
        const saved = selected[0].snapshot
        try {
          const result = await captureMarketplacePaymentUnderLock(container, candidate.cart_id, {
            session_id: saved.session_id, collection_id: saved.collection_id, intent_id: saved.intent_id,
            amount: saved.amount, currency_code: saved.currency_code,
          }, 'captured-only')
          if (!result) throw new Error('Uncaptured payment requires verified payment reconciliation')
        } catch {
          // No PII or provider details in durable error text. Failure remains
          // pending and paced; failed lock-session queries stop further writes.
          await query(`UPDATE marketplace_capture_tail SET last_error = ?, updated_at = now() WHERE payment_id = ?`,
            ['Tail reconciliation required; no automatic financial retry', candidate.payment_id])
        }
      })
    } catch {
      container.resolve(ContainerRegistrationKeys.LOGGER).warn('Marketplace capture tail retry deferred; lock or storage unavailable')
    }
  }
}
export const config = { name: 'marketplace-capture-tail-recovery', schedule: '*/5 * * * *' }
