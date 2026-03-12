import { createProductCategoriesWorkflow } from '@medusajs/medusa/core-flows'
import { kebabCase } from '@medusajs/framework/utils'
import {
  WorkflowResponse,
  createWorkflow,
  transform
} from '@medusajs/workflows-sdk'

import { AcceptRequestDTO } from '@mercurjs/framework'

import { updateRequestWorkflow } from './update-request'
import { parseProductCategoryRequestData } from '../utils/request-data-schemas'

export const acceptProductCategoryRequestWorkflow = createWorkflow(
  'accept-product-category-request',
  function (input: AcceptRequestDTO) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductCategoryRequestData(input.data)
    )

    const handle = transform({ requestData }, ({ requestData }) =>
      requestData.handle === '' ? kebabCase(requestData.name) : requestData.handle
    )

    const categoryData = transform({ requestData, handle }, ({ requestData, handle }) => {
      const { details: _details, ...rest } = requestData
      return {
        ...rest,
        handle,
        is_active: true
      }
    })

    const additionalData = transform({ requestData }, ({ requestData }) =>
      requestData.details ? { details: requestData.details } : undefined
    )

    const productCategory = createProductCategoriesWorkflow.runAsStep({
      input: {
        product_categories: [categoryData],
        additional_data: additionalData
      }
    })

    updateRequestWorkflow.runAsStep({ input })
    return new WorkflowResponse(productCategory[0])
  }
)
