import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { settleOrderPayoutStep } from '../steps/settle-order-payout'

export const processPayoutForOrderWorkflow = createWorkflow(
  { name: 'process-payout-for-order' },
  function (input: { order_id: string }) {
    const result = settleOrderPayoutStep(input)
    return new WorkflowResponse(result)
  }
)
