import { WorkflowResponse, WorkflowData, createWorkflow } from '@medusajs/workflows-sdk'

import { UpdateCommissionRuleDTO } from '@mercurjs/framework'

import { updateCommissionRuleStep } from '../steps'

export const updateCommissionRuleWorkflow = createWorkflow(
  'update-commission-rule',
  function (input: WorkflowData<UpdateCommissionRuleDTO>) {
    return new WorkflowResponse(updateCommissionRuleStep(input))
  }
)
