import { updateCollectionsWorkflow } from '@medusajs/medusa/core-flows'
import {
  WorkflowResponse,
  createWorkflow,
  transform
} from '@medusajs/workflows-sdk'

import { AcceptRequestDTO } from '@mercurjs/framework'

import { updateRequestWorkflow } from './update-request'
import { parseProductCollectionUpdateRequestData } from '../utils/request-data-schemas'

export const acceptProductCollectionUpdateRequestWorkflow = createWorkflow(
  'accept-product-collection-update-request',
  function (input: AcceptRequestDTO) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductCollectionUpdateRequestData(input.data)
    )
    const { collection_id, ...updateData } = requestData

    const collection = updateCollectionsWorkflow.runAsStep({
      input: {
        selector: { id: collection_id },
        update: updateData
      }
    })

    updateRequestWorkflow.runAsStep({ input })
    return new WorkflowResponse(collection[0])
  }
)
