import { FulfillmentDTO, OrderDTO, OrderWorkflow, PaymentCollectionDTO } from '@medusajs/framework/types'
import { MedusaError, OrderStatus, OrderWorkflowEvents } from '@medusajs/framework/utils'
import { StepResponse, WorkflowData, WorkflowResponse, createStep, createWorkflow, transform, when } from '@medusajs/framework/workflows-sdk'
import { CancelValidateOrderStepInput, cancelOrdersStep, deleteReservationsByLineItemsStep, emitEventStep, useQueryGraphStep } from '@medusajs/medusa/core-flows'
import { orderRefundScopeFields, settleOrderRefundStep } from '../steps/settle-order-refund'
import type { OrderRefundSnapshot } from '../../../utils/order-refund-plan'

export const cancelValidateOrder = createStep(
  'cancel-validate-order',
  async ({ order }: CancelValidateOrderStepInput) => {
    const order_ = order as OrderDTO & { payment_collections: PaymentCollectionDTO[]; fulfillments: FulfillmentDTO[] }
    if ((order_.fulfillments ?? []).some((fulfillment) => !fulfillment.canceled_at)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'All fulfillments must be canceled before canceling an order')
    }
    // CANCELED is NOT blanket permission to retry. The financial step verifies a
    // matching completed settlement under its scope lock before allowing progress.
    return new StepResponse({ validated: true })
  }
)

export const cancelOrderWorkflow = createWorkflow(
  'cancel-single-order',
  (input: WorkflowData<OrderWorkflow.CancelOrderWorkflowInput>) => {
    const orderQuery = useQueryGraphStep({ entity: 'orders', fields: orderRefundScopeFields,
      filters: { id: input.order_id }, options: { throwIfKeyNotFound: true } }).config({ name: 'get-cart' })
    const order = transform({ orderQuery }, ({ orderQuery }) => orderQuery.data[0])
    const validation = cancelValidateOrder({ order, input })
    const settlement = settleOrderRefundStep(transform({ input, order, validation }, ({ input, order }) => ({
      kind: 'cancel' as const, order_id: input.order_id, scope_order: order as unknown as OrderRefundSnapshot,
    })))
    const completedOrder = transform({ order, settlement }, ({ order, settlement }) => {
      if (settlement.receipt.phase !== 'completed' || settlement.plan.order_id !== order.id) throw new Error('Cancellation settlement is incomplete')
      return order
    })
    // Native workflow scheduling follows dependency edges, not statement order.
    // Monetary completion is an ancestor of ALL order/inventory/event effects.
    const canceled = when({ completedOrder }, ({ completedOrder }) => completedOrder.status !== OrderStatus.CANCELED).then(() =>
      cancelOrdersStep(transform({ completedOrder }, ({ completedOrder }) => ({ orderIds: [completedOrder.id] })))
    )
    const reservations = deleteReservationsByLineItemsStep(transform(
      { completedOrder, canceled }, ({ completedOrder }) => (completedOrder.items ?? []).map((item) => item.id)
    ))
    const event = emitEventStep(transform({ completedOrder, canceled, reservations }, ({ completedOrder }) => ({
      eventName: OrderWorkflowEvents.CANCELED, data: { id: completedOrder.id },
    })))
    return new WorkflowResponse(transform({ completedOrder, event }, ({ completedOrder }) => completedOrder.id))
  }
)
