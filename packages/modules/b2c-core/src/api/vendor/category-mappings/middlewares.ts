import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework'

import {
  VendorCreateCategoryMapping,
  VendorGetCategoryMappingsParams,
  VendorUpdateCategoryMapping,
} from './validators'
import { vendorCategoryMappingsQueryConfig } from './query-config'

export const vendorCategoryMappingsMiddlewares: MiddlewareRoute[] = [
  {
    method: ['GET'],
    matcher: '/vendor/category-mappings',
    middlewares: [
      validateAndTransformQuery(
        VendorGetCategoryMappingsParams,
        vendorCategoryMappingsQueryConfig.list
      ),
    ],
  },
  {
    method: ['POST'],
    matcher: '/vendor/category-mappings',
    middlewares: [validateAndTransformBody(VendorCreateCategoryMapping)],
  },
  {
    method: ['PUT'],
    matcher: '/vendor/category-mappings/:id',
    middlewares: [validateAndTransformBody(VendorUpdateCategoryMapping)],
  },
]
