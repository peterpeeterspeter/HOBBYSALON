import { createHash } from 'node:crypto'
import { MedusaError, PaymentEvents } from '@medusajs/framework/utils'
import { assertCommerceCartLock, commerceCartLockQuery } from './commerce-cart-lock'
import { marketplaceSnapshotKey } from './marketplace-capture'

export const MARKETPLACE_CAPTURE_ACK_SUBSCRIBER = 'split-payment-payment-captured-handler' as const
export const MARKETPLACE_CAPTURE_ACK_VERSION = 1 as const

export type MarketplaceCaptureTaggedEvent = {
  name?: string
  data: { id: string }
  metadata: { marketplace_capture_event_id: string; marketplace_capture_id: string }
}
export type MarketplaceCaptureAckReceipt = Readonly<{
  payment_id: string
  cart_id: string
  capture_id: string
  event_id: string
  snapshot_sha256: string
  subscriber_id: typeof MARKETPLACE_CAPTURE_ACK_SUBSCRIBER
  protocol_version: typeof MARKETPLACE_CAPTURE_ACK_VERSION
  acked_at: string | Date
}>
export type MarketplaceCaptureAckConsumer = (
  container: object, cartId: string, event: MarketplaceCaptureTaggedEvent
) => Promise<MarketplaceCaptureAckReceipt>

const fail = (): never => {
  throw new MedusaError(MedusaError.Types.CONFLICT, 'Marketplace consumer ACK inconsistent or pending; reconciliation/retry required')
}
const identity = (v: unknown): string => {
  if (typeof v !== 'string' || !v || v.length > 255 || v.trim() !== v || /[\u0000-\u001f\u007f]/.test(v)) fail()
  return v as string
}
async function query(container: object, cartId: string, sql: string, values: any[] = []) {
  assertCommerceCartLock(container, cartId)
  const result = await commerceCartLockQuery(container, cartId, sql, values)
  assertCommerceCartLock(container, cartId)
  if (!Array.isArray(result?.rows)) fail()
  return result.rows
}
async function readTail(container: object, cartId: string, paymentId: string) {
  const rows = await query(container, cartId, 'SELECT * FROM marketplace_capture_tail WHERE payment_id = ?', [paymentId])
  if (rows.length !== 1 || rows[0].payment_id !== paymentId || rows[0].cart_id !== cartId) fail()
  return rows[0]
}
function boundIdentity(row: any, event?: MarketplaceCaptureTaggedEvent) {
  const s = row.snapshot
  if (!s || s.version !== 1 || s.payment_id !== row.payment_id || s.cart_id !== row.cart_id ||
      !Array.isArray(s.allocations) || !s.allocations.length || !row.accounting_at || !row.event_enqueued_at || !row.completed_at) fail()
  const hash = createHash('sha256').update(marketplaceSnapshotKey(s)).digest('hex')
  const binding = {
    payment_id: identity(row.payment_id), cart_id: identity(row.cart_id), capture_id: identity(row.capture_id),
    event_id: identity(row.event_id), snapshot_sha256: hash,
    subscriber_id: MARKETPLACE_CAPTURE_ACK_SUBSCRIBER, protocol_version: MARKETPLACE_CAPTURE_ACK_VERSION
  }
  if (binding.event_id !== `marketplace-captured-${hash}`) fail()
  if (event && (event.data?.id !== binding.payment_id || event.metadata?.marketplace_capture_event_id !== binding.event_id ||
      event.metadata?.marketplace_capture_id !== binding.capture_id || (event.name !== undefined && event.name !== PaymentEvents.CAPTURED))) fail()
  return binding
}
function receipt(row: any, binding: ReturnType<typeof boundIdentity>): MarketplaceCaptureAckReceipt {
  for (const key of Object.keys(binding) as (keyof typeof binding)[]) if (row?.[key] !== binding[key]) fail()
  if (!(typeof row.acked_at === 'string' || row.acked_at instanceof Date) || !Number.isFinite(new Date(row.acked_at).getTime())) fail()
  // Return only the contract, not arbitrary database columns or mutable authority.
  return Object.freeze({ ...binding, acked_at: row.acked_at instanceof Date ? row.acked_at.toISOString() : row.acked_at })
}

/** Trusted startup wiring ONLY: construct in the actual tagged business consumer.
 * The validator must perform ALL current native capture/cart/order/split/refund
 * checks under the SAME cart capability; it must throw on failure and return void.
 * No exported low-level INSERT, client validation Boolean or portable token.
 * This callback boundary is not a sandbox against privileged same-process JS:
 * a malicious trusted caller can supply a fake validator or write SQL itself.
 * Parent must integrate after review; constructing this API is NOT queue dispatch.
 */
export function createMarketplaceCaptureAckConsumer(options: {
  subscriberId: typeof MARKETPLACE_CAPTURE_ACK_SUBSCRIBER
  validateUnderLock: (container: object, event: MarketplaceCaptureTaggedEvent) => Promise<void>
}): MarketplaceCaptureAckConsumer {
  if (options?.subscriberId !== MARKETPLACE_CAPTURE_ACK_SUBSCRIBER || typeof options?.validateUnderLock !== 'function') fail()
  const validate = options.validateUnderLock
  return async (container, cartId, event) => {
    identity(cartId)
    assertCommerceCartLock(container, cartId)
    const paymentId = identity(event?.data?.id)
    // Untagged native events and producer enqueue markers cannot issue ACKs.
    if (!event?.metadata?.marketplace_capture_event_id || !event?.metadata?.marketplace_capture_id) fail()
    const before = boundIdentity(await readTail(container, cartId, paymentId), event)
    // Always validate, including replay with an existing durable receipt.
    if (await validate(container, event) !== undefined) fail()
    assertCommerceCartLock(container, cartId)
    const after = boundIdentity(await readTail(container, cartId, paymentId), event)
    for (const key of Object.keys(before) as (keyof typeof before)[]) if (after[key] !== before[key]) fail()
    await query(container, cartId, `INSERT INTO marketplace_capture_consumer_ack
      (payment_id, cart_id, capture_id, event_id, snapshot_sha256, subscriber_id, protocol_version)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (payment_id) DO NOTHING`,
    [after.payment_id, after.cart_id, after.capture_id, after.event_id, after.snapshot_sha256, after.subscriber_id, after.protocol_version])
    // Physical-session autocommit, synchronous_commit=on supplied by cartlock.
    // No invented ambient transaction/commit. INSERT return alone is NOT enough.
    const rows = await query(container, cartId, 'SELECT * FROM marketplace_capture_consumer_ack WHERE payment_id = ?', [paymentId])
    if (rows.length !== 1) fail()
    return receipt(rows[0], after)
  }
}

/** Diagnostic identity read, not fresh financial validation or queue success.
 * Missing receipt returns null even when the tail says completed/enqueued.
 * Existing receipt must bind exactly to a ready immutable tail; mismatch throws.
 * A fully_closed decision ALSO needs current accounting validation externally.
 */
export async function readMarketplaceCaptureAckUnderLock(
  container: object, cartId: string, paymentId: string
): Promise<MarketplaceCaptureAckReceipt | null> {
  identity(cartId); identity(paymentId)
  const rows = await query(container, cartId, 'SELECT * FROM marketplace_capture_consumer_ack WHERE payment_id = ?', [paymentId])
  if (!rows.length) return null
  if (rows.length !== 1) fail()
  return receipt(rows[0], boundIdentity(await readTail(container, cartId, paymentId)))
}
