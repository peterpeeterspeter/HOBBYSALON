import { WorkflowResponse, WorkflowData, createWorkflow, transform } from '@medusajs/framework/workflows-sdk'
import { AdminUpdateOrderReturnRequestDTO, VendorUpdateOrderReturnRequestDTO } from '@mercurjs/framework'
import { refundSellerOrderForReturnWorkflow } from '@mercurjs/b2c-core/workflows'
import { retrieveOrderFromReturnRequestStep } from '../steps'
import { prepareNativeReturnStep } from '../steps/prepare-native-return'

/** Native preparation is durable outside outer compensation. Refund must finish
 * before this workflow returns and the parent persists the refunded status. */
export const proceedReturnRequestWorkflow = createWorkflow(
  'proceed-return-request',
  function (input: WorkflowData<VendorUpdateOrderReturnRequestDTO | AdminUpdateOrderReturnRequestDTO>) {
    const order = retrieveOrderFromReturnRequestStep(input)
    const plan = transform({ order, input }, ({ order, input }) => {
      if (order.order_return_request.id !== input.id) throw new Error('Return request identity mismatch')
      return {
        request_id: order.order_return_request.id,
        order_id: order.order_id,
        location_id: input.location_id ?? null,
        items: order.order_return_request.line_items.map((item) => ({
          id: item.line_item_id, quantity: item.quantity, reason_id: item.reason_id ?? null,
        })),
      }
    })
    const prepared = prepareNativeReturnStep(plan)
    // Only the ledger's frozen plan can authorize money, never a fresh request snapshot.
    const refundInput = transform({ prepared }, ({ prepared }) => ({
      order_id: prepared.plan.order_id,
      operation_id: prepared.plan.request_id,
      return_lines: prepared.plan.items.map(item => ({ line_item_id: item.id, quantity: item.quantity })),
    }))
    const refund = refundSellerOrderForReturnWorkflow.runAsStep({ input: refundInput })
    return new WorkflowResponse(transform({ prepared, refund }, ({ prepared }) => ({
      id: prepared.identity.order_change_id, return_id: prepared.identity.return_id, order_id: prepared.plan.order_id,
    })))
  }
)
