import { WorkflowData, WorkflowResponse, createWorkflow, transform } from '@medusajs/framework/workflows-sdk'
import { settleOrderRefundStep } from '../steps/settle-order-refund'
import type { ReturnRefundLine } from '../../../utils/return-refund-amount'

export type RefundSellerOrderForReturnInput = {
  order_id: string
  /** Optional reduction; cannot exceed the explicitly selected merchandise. */
  requested_refund_amount?: number
  return_lines: ReturnRefundLine[]
  /** Stable existing return request identity; required at runtime for settlement. */
  operation_id?: string
}

/** Quantity-aware customer refund and seller reversal, with a durable fixed plan.
 * A replay returns the saved completion, not a newly calculated remaining balance.
 */
export const refundSellerOrderForReturnWorkflow = createWorkflow(
  'refund-seller-order-for-return',
  (input: WorkflowData<RefundSellerOrderForReturnInput>) => {
    const settlement = settleOrderRefundStep(transform({ input }, ({ input }) => ({
      kind: 'return' as const, order_id: input.order_id, operation_id: input.operation_id,
      return_lines: input.return_lines, requested_refund_amount: input.requested_refund_amount,
    })))
    return new WorkflowResponse(transform({ settlement }, ({ settlement }) => {
      if (settlement.receipt.phase !== 'completed') throw new Error('Return refund settlement is incomplete')
      return { order_id: settlement.plan.order_id, customer_refund: settlement.plan.customerRefund,
        seller_reversal: settlement.plan.sellerReversal, stripe_refund_applied: settlement.plan.customerRefund > 0 }
    }))
  }
)
