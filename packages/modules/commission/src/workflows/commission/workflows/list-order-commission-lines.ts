import {
  WorkflowResponse,
  WorkflowData,
  createWorkflow
} from '@medusajs/framework/workflows-sdk'

import { listOrderCommissionLinesStep } from '../steps'

export const listOrderCommissionLinesWorkflow = createWorkflow(
  'list-order-commission-lines',
  function (input: WorkflowData<{ order_id: string }>) {
    return new WorkflowResponse(listOrderCommissionLinesStep(input))
  }
)
