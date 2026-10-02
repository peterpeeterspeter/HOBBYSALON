import {
  MiddlewareRoute,
  authenticate,
  validateAndTransformQuery
} from '@medusajs/framework'

import { orderSetQueryConfig } from './query-config'
import { StoreGetOrderSetParams } from './validators'

const customerAuth = authenticate('customer', ['bearer', 'session'])

export const storeOrderSetMiddlewares: MiddlewareRoute[] = [
  {
    method: ['GET'],
    matcher: '/store/order-set',
    middlewares: [
      customerAuth,
      validateAndTransformQuery(
        StoreGetOrderSetParams,
        orderSetQueryConfig.list
      )
    ]
  },
  {
    method: ['GET'],
    matcher: '/store/order-set/:id',
    middlewares: [
      customerAuth,
      validateAndTransformQuery(
        StoreGetOrderSetParams,
        orderSetQueryConfig.retrieve
      )
    ]
  }
]
