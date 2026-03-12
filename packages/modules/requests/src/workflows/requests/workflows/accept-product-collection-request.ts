import { kebabCase } from '@medusajs/framework/utils'
import { createCollectionsWorkflow } from '@medusajs/medusa/core-flows'
import {
  WorkflowResponse,
  createWorkflow,
  transform
} from '@medusajs/workflows-sdk'

import { AcceptRequestDTO } from '@mercurjs/framework'

import { updateRequestWorkflow } from './update-request'
import { parseProductCollectionRequestData } from '../utils/request-data-schemas'

export const acceptProductCollectionRequestWorkflow = createWorkflow(
  'accept-product-collection-request',
  function (input: AcceptRequestDTO) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductCollectionRequestData(input.data)
    )

    const collection = createCollectionsWorkflow.runAsStep({
      input: {
        collections: [
          {
            title: requestData.title,
            handle:
              requestData.handle === ''
                ? kebabCase(requestData.title)
                : requestData.handle
          }
        ],
        additional_data: requestData.details ? {
          details: requestData.details
        } : undefined
      }
    })

    updateRequestWorkflow.runAsStep({ input })
    return new WorkflowResponse(collection[0])
  }
)
