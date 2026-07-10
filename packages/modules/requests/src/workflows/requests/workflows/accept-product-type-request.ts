import {
  WorkflowResponse,
  WorkflowData,
  createWorkflow,
  transform
} from '@medusajs/framework/workflows-sdk'
import { createProductTypesWorkflow } from '@medusajs/medusa/core-flows'

import { AcceptRequestDTO } from '@mercurjs/framework'

import { updateRequestWorkflow } from './update-request'
import { parseProductTypeRequestData } from '../utils/request-data-schemas'

export const acceptProductTypeRequestWorkflow = createWorkflow(
  'accept-product-type-request',
  function (input: WorkflowData<AcceptRequestDTO>) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductTypeRequestData(input.data)
    )

    const result = createProductTypesWorkflow.runAsStep({
      input: {
        product_types: [requestData]
      }
    })

    updateRequestWorkflow.runAsStep({ input })
    return new WorkflowResponse(result[0])
  }
)
