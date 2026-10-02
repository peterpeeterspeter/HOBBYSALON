import {
  WorkflowData,
  WorkflowResponse,
  createWorkflow,
  transform,
  when
} from '@medusajs/framework/workflows-sdk'
import { useQueryGraphStep } from '@medusajs/medusa/core-flows'

import { createPayoutReversalStep } from '../../payout/steps'
import { refundSplitOrderPaymentWorkflow } from '../../split-order-payment/workflows'
import { allocateRefundAndReversal } from '../../../utils/refund-allocation'

export type RefundSellerOrderForReturnInput = {
  order_id: string
  /** Optional override; defaults to returned line totals when omitted. */
  requested_refund_amount?: number
  line_item_ids?: string[]
}

/**
 * EC15 — Stripe-grounded refund + seller transfer reversal for an approved return.
 * Uses the same allocation rules as cancel (EC05).
 */
export const refundSellerOrderForReturnWorkflow = createWorkflow(
  'refund-seller-order-for-return',
  (input: WorkflowData<RefundSellerOrderForReturnInput>) => {
    const orderQuery = useQueryGraphStep({
      entity: 'orders',
      fields: [
        'id',
        'currency_code',
        'items.id',
        'items.quantity',
        'items.unit_price',
        'items.subtotal',
        'items.total',
        'split_order_payment.*',
        'payouts.*',
        'payouts.amount',
        'payouts.currency_code',
        'payouts.reversals.*'
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true }
    }).config({ name: 'get-order-for-return-refund' })

    const order = transform(
      { orderQuery },
      ({ orderQuery }) => orderQuery.data[0]
    )

    const refundPlan = transform({ order, input }, ({ order, input }) => {
      const captured = Number(order.split_order_payment?.captured_amount ?? 0)
      const alreadyRefunded = Number(
        order.split_order_payment?.refunded_amount ?? 0
      )
      const payout = order.payouts?.[0]
      const transferred = payout ? Number(payout.amount ?? 0) : 0
      const alreadyReversed = (payout?.reversals ?? []).reduce(
        (sum: number, rev: { amount?: number | string }) =>
          sum + Number(rev.amount ?? 0),
        0
      )
      const commissionAmount =
        transferred > 0 ? Math.max(0, captured - transferred) : 0

      let requested = Number(input.requested_refund_amount ?? NaN)
      if (!Number.isFinite(requested) || requested <= 0) {
        const ids = new Set(input.line_item_ids ?? [])
        const items = (order.items ?? []).filter(
          (item: { id: string }) => ids.size === 0 || ids.has(item.id)
        )
        requested = items.reduce(
          (
            sum: number,
            item: {
              total?: number
              subtotal?: number
              unit_price?: number
              quantity?: number
            }
          ) => {
            const lineTotal =
              Number(item.total ?? item.subtotal ?? 0) ||
              Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)
            return sum + lineTotal
          },
          0
        )
      }

      if (!Number.isFinite(requested) || requested <= 0) {
        requested = Math.max(0, captured - alreadyRefunded)
      }

      const allocation = allocateRefundAndReversal({
        capturedAmount: captured,
        alreadyRefundedAmount: alreadyRefunded,
        transferredAmount: transferred,
        alreadyReversedAmount: alreadyReversed,
        commissionAmount,
        requestedCustomerRefund: requested
      })

      return {
        ...allocation,
        split_order_payment_id: order.split_order_payment?.id ?? null,
        payout_id: payout?.id ?? null,
        currency_code: order.currency_code
      }
    })

    when(refundPlan, (plan) => !!plan.split_order_payment_id && plan.customerRefund > 0).then(
      () => {
        refundSplitOrderPaymentWorkflow.runAsStep({
          input: transform({ refundPlan }, ({ refundPlan }) => ({
            id: refundPlan.split_order_payment_id as string,
            amount: refundPlan.customerRefund
          }))
        })
      }
    )

    when(refundPlan, (plan) => !!plan.payout_id && plan.sellerReversal > 0).then(
      () => {
        createPayoutReversalStep(
          transform({ refundPlan }, ({ refundPlan }) => ({
            payout_id: refundPlan.payout_id,
            amount: refundPlan.sellerReversal,
            currency_code: refundPlan.currency_code
          }))
        )
      }
    )

    return new WorkflowResponse(
      transform({ refundPlan, order }, ({ refundPlan, order }) => ({
        order_id: order.id,
        customer_refund: refundPlan.customerRefund,
        seller_reversal: refundPlan.sellerReversal,
        stripe_refund_applied: refundPlan.customerRefund > 0
      }))
    )
  }
)
