import {
  FulfillmentDTO,
  OrderDTO,
  OrderWorkflow,
  PaymentCollectionDTO
} from '@medusajs/framework/types'
import {
  MedusaError,
  OrderStatus,
  OrderWorkflowEvents
} from '@medusajs/framework/utils'
import {
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
  parallelize,
  transform
} from '@medusajs/framework/workflows-sdk'
import {
  CancelValidateOrderStepInput,
  cancelOrdersStep,
  deleteReservationsByLineItemsStep,
  emitEventStep,
  useQueryGraphStep
} from '@medusajs/medusa/core-flows'

import { createPayoutReversalStep } from '../../payout/steps'
import { refundSplitOrderPaymentWorkflow } from '../../split-order-payment/workflows'
import { allocateRefundAndReversal } from '../../../utils/refund-allocation'

export const cancelValidateOrder = createStep(
  'cancel-validate-order',
  async ({ order }: CancelValidateOrderStepInput) => {
    const order_ = order as OrderDTO & {
      payment_collections: PaymentCollectionDTO[]
      fulfillments: FulfillmentDTO[]
    }

    if (order_.status === OrderStatus.CANCELED) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id ${order.id} has been canceled.`
      )
    }

    if (order_.fulfillments.some((o) => !o.canceled_at)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `All fulfillments must be canceled before canceling an order`
      )
    }
  }
)

export const cancelOrderWorkflow = createWorkflow(
  'cancel-single-order',
  (input: WorkflowData<OrderWorkflow.CancelOrderWorkflowInput>) => {
    const orderQuery = useQueryGraphStep({
      entity: 'orders',
      fields: [
        'id',
        'status',
        'currency_code',
        'items.id',
        'fulfillments.canceled_at',
        'split_order_payment.*',
        'payouts.*',
        'payouts.amount',
        'payouts.currency_code',
        'payouts.reversals.*'
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true }
    }).config({ name: 'get-cart' })

    const order = transform(
      { orderQuery },
      ({ orderQuery }) => orderQuery.data[0]
    )

    cancelValidateOrder({ order, input })

    const lineItemIds = transform({ order }, ({ order }) => {
      return order.items?.map((i) => i.id)
    })

    const payoutId = transform({ order }, ({ order }) => {
      return order.payouts && order.payouts[0] ? order.payouts[0].id : null
    })

    const refundPlan = transform({ order }, ({ order }) => {
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
      // Commission is captured − transferred when a payout exists; otherwise 0
      // until commission is known (no transfer to reverse yet).
      const commissionAmount =
        transferred > 0 ? Math.max(0, captured - transferred) : 0

      return allocateRefundAndReversal({
        capturedAmount: captured,
        alreadyRefundedAmount: alreadyRefunded,
        transferredAmount: transferred,
        alreadyReversedAmount: alreadyReversed,
        commissionAmount,
        requestedCustomerRefund: Math.max(0, captured - alreadyRefunded)
      })
    })

    parallelize(
      deleteReservationsByLineItemsStep(lineItemIds),
      cancelOrdersStep({ orderIds: [order.id] }),
      refundSplitOrderPaymentWorkflow.runAsStep({
        input: {
          id: order.split_order_payment.id,
          amount: refundPlan.customerRefund
        }
      }),
      createPayoutReversalStep({
        payout_id: payoutId,
        amount: refundPlan.sellerReversal,
        currency_code: order.currency_code
      }),
      emitEventStep({
        eventName: OrderWorkflowEvents.CANCELED,
        data: { id: order.id }
      })
    )

    return new WorkflowResponse(order.id)
  }
)
