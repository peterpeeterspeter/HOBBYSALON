import {
  WorkflowResponse,
  createWorkflow,
  transform
} from '@medusajs/framework/workflows-sdk'
import { createProductTagsWorkflow } from '@medusajs/medusa/core-flows'

import { AcceptRequestDTO } from '@mercurjs/framework'

import { updateRequestWorkflow } from './update-request'
import { parseProductTagRequestData } from '../utils/request-data-schemas'

export const acceptProductTagRequestWorkflow = createWorkflow(
  'accept-product-tag-request',
  function (input: AcceptRequestDTO) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductTagRequestData(input.data)
    )

    const result = createProductTagsWorkflow.runAsStep({
      input: {
        product_tags: [requestData]
      }
    })

    updateRequestWorkflow.runAsStep({ input })
    return new WorkflowResponse(result[0])
  }
)
