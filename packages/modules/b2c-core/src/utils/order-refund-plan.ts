import { createHash } from 'node:crypto'
import { MathBN, MedusaError } from '@medusajs/framework/utils'
import { allocateRefundAndReversal } from './refund-allocation'
import {
  calculateReturnRefundAmount,
  type ReturnRefundLine,
} from './return-refund-amount'
import type { SettlementInput, SettlementPlan } from './refund-settlement'

type Amount = Parameters<typeof MathBN.convert>[0]
export type OrderRefundSnapshot = {
  id: string
  status?: string
  currency_code: string
  items?: Parameters<typeof calculateReturnRefundAmount>[0]['items']
  fulfillments?: { canceled_at?: unknown }[]
  payment_collections?: { id: string; captured_amount?: Amount }[]
  split_order_payment?: {
    id: string; payment_collection_id: string; currency_code: string
    captured_amount: Amount; refunded_amount: Amount
  } | null
  payouts?: {
    id: string; amount: Amount; currency_code: string
    reversals?: { amount: Amount }[]
  }[]
}
export type OrderRefundRequest = {
  kind: 'return' | 'cancel'
  order_id: string
  operation_id?: string
  return_lines?: ReturnRefundLine[]
  requested_refund_amount?: number
}

function identity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}

/** Snapshot the ORIGINAL request, not mutable balances or a recalculated refund.
 * Sorting only changes selection order; duplicates/invalid quantities are rejected,
 * not coalesced. No precision rounding before hashing an explicit reduction.
 */
export function snapshotOrderRefundRequest(input: OrderRefundRequest) {
  if (!identity(input.order_id) || !['return', 'cancel'].includes(input.kind)) {
    throw new Error('Invalid refund operation identity or kind')
  }
  if (input.kind === 'cancel') {
    const operation_id = `cancel:${input.order_id}`
    if (!identity(operation_id)) throw new Error('Invalid cancellation operation identity')
    return { request: { kind: 'cancel' as const, order_id: input.order_id }, operation_id,
      fingerprint: createHash('sha256').update(JSON.stringify({ version: 1, kind: 'cancel', selection: 'remaining-balance' })).digest('hex') }
  }
  if (!identity(input.operation_id) || !identity(`return:${input.operation_id}`)) {
    throw new Error('Return refund requires a stable operation identity')
  }
  if (!Array.isArray(input.return_lines) || input.return_lines.length === 0) throw new Error('Return refund requires explicit return lines')
  const ids = new Set<string>()
  const return_lines = input.return_lines.map((line) => {
    if (!line || !identity(line.line_item_id) || ids.has(line.line_item_id) ||
        !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error('Invalid return line selection')
    ids.add(line.line_item_id)
    return { line_item_id: line.line_item_id, quantity: line.quantity }
  }).sort((a, b) => a.line_item_id < b.line_item_id ? -1 : a.line_item_id > b.line_item_id ? 1 : 0)
  if (input.requested_refund_amount !== undefined &&
      (typeof input.requested_refund_amount !== 'number' || !Number.isFinite(input.requested_refund_amount) || input.requested_refund_amount <= 0)) {
    throw new Error('Invalid explicit return refund amount')
  }
  const request: OrderRefundRequest = { kind: 'return', order_id: input.order_id,
    operation_id: input.operation_id, return_lines, requested_refund_amount: input.requested_refund_amount }
  return { request, operation_id: `return:${input.operation_id}`,
    fingerprint: createHash('sha256').update(JSON.stringify({ version: 1, kind: 'return',
      selection: return_lines, reduction: input.requested_refund_amount ?? null })).digest('hex') }
}

export function orderRefundScope(order: OrderRefundSnapshot): string {
  if (!order || !identity(order.id)) throw new Error('Refund order not found')
  const split = order.split_order_payment
  if (split) {
    if (!identity(split.id) || !identity(split.payment_collection_id)) throw new Error('Invalid split payment collection')
    return split.payment_collection_id
  }
  const collections = order.payment_collections ?? []
  if (collections.length > 1 || (collections.length === 1 && !identity(collections[0].id))) {
    throw new Error('Ambiguous payment collection')
  }
  return collections.length === 1 ? collections[0].id : `order:${order.id}`
}

export function nonnegativeRefundAmount(value: Amount | null | undefined): number {
  if (value == null) throw new Error('Missing financial amount')
  const amount = MathBN.convert(value)
  if (!amount.isFinite() || MathBN.lt(amount, 0)) throw new Error('Invalid financial amount')
  const numeric = Number(amount.toString())
  if (!Number.isFinite(numeric)) throw new Error('Invalid financial amount')
  return numeric
}

/** Called only inside the settlement engine's plan callback, after requerying. */
export function allocateOrderRefund(
  order: OrderRefundSnapshot, request: OrderRefundRequest,
  input: SettlementInput, commissionLines: { item_line_id: string; value: Amount }[]
): Omit<SettlementPlan, 'payment_id'> {
  if (order.id !== input.order_id || orderRefundScope(order) !== input.scope_id) throw new Error('Refund scope changed')
  if (typeof order.currency_code !== 'string' || !/^[a-z]{3}$/i.test(order.currency_code)) throw new Error('Invalid refund currency')
  const currency_code = order.currency_code.toLowerCase()
  const split = order.split_order_payment
  if (split && split.currency_code?.toLowerCase() !== currency_code) throw new Error('Split refund currency mismatch')
  const captured = split ? nonnegativeRefundAmount(split.captured_amount) : 0
  const alreadyRefunded = split ? nonnegativeRefundAmount(split.refunded_amount) : 0
  if (alreadyRefunded > captured) throw new Error('Invalid refunded balance')
  if (!split && (order.payment_collections ?? []).some((collection) =>
    nonnegativeRefundAmount(collection.captured_amount) > 0)) throw new Error('Captured order is missing its split payment')

  const payouts = order.payouts ?? []
  if (payouts.length > 1) throw new Error('Ambiguous order payouts')
  const payout = payouts[0]
  if (payout && (!identity(payout.id) || payout.currency_code?.toLowerCase() !== currency_code)) throw new Error('Invalid payout identity or currency')
  const transferred = payout ? nonnegativeRefundAmount(payout.amount) : 0
  if (!split && transferred > 0) throw new Error('Transferred order is missing its split payment')
  const alreadyReversed = Number((payout?.reversals ?? []).reduce(
    (sum, reversal) => MathBN.add(sum, nonnegativeRefundAmount(reversal.amount)), MathBN.convert(0)
  ).toString())
  if (alreadyReversed > transferred) throw new Error('Invalid payout reversal balance')
  const itemIds = (order.items ?? []).map((item) => item.id)
  const covered = new Set(commissionLines.map((line) => line.item_line_id))
  if (payout && itemIds.some((id) => !covered.has(id))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Commission not ready for order ${order.id}: missing lines`)
  }
  // Preserve authoritative ORIGINAL commission, not capture minus a payout that
  // was already reduced by earlier pre-transfer refunds. Explicit zero is ready.
  const commissionAmount = payout ? Number(commissionLines.reduce(
    (sum, line) => MathBN.add(sum, nonnegativeRefundAmount(line.value)), MathBN.convert(0)
  ).toString()) : 0
  const requested = request.kind === 'return' ? calculateReturnRefundAmount({
    items: order.items ?? [], returnLines: request.return_lines!, currencyCode: currency_code,
    requestedRefundAmount: request.requested_refund_amount,
  }) : Math.max(0, captured - alreadyRefunded)
  const tolerance = Math.min(1e-9, Number.EPSILON * Math.max(1, captured, alreadyRefunded) * 4)
  if (requested > captured - alreadyRefunded + tolerance) throw new Error('Return refund exceeds the remaining captured amount')
  if (requested > 0 && !split) throw new Error('Positive refund requires a split payment')
  const allocation = allocateRefundAndReversal({ currencyCode: currency_code,
    capturedAmount: captured, alreadyRefundedAmount: alreadyRefunded,
    transferredAmount: transferred, alreadyReversedAmount: alreadyReversed,
    commissionAmount, requestedCustomerRefund: requested })
  return { order_id: input.order_id, operation_id: input.operation_id, scope_id: input.scope_id,
    split_order_payment_id: split?.id ?? null, payout_id: payout?.id ?? null, currency_code,
    customerRefund: allocation.customerRefund, sellerReversal: allocation.sellerReversal }
}
