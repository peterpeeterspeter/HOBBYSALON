import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'

import { getFormattedOrderSetListWorkflow } from '../../../../workflows/order-set/workflows'
import { defaultStoreRetrieveOrderSetFields } from '../query-config'

/**
 * @oas [get] /store/order-set/{id}
 * operationId: "StoreGetOrderSet"
 * summary: "Get Order Set"
 * description: "Retrieves an order set owned by the authenticated customer."
 * x-authenticated: true
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      'Unauthorized'
    )
  }

  const {
    result: { data }
  } = await getFormattedOrderSetListWorkflow(req.scope).run({
    input: {
      filters: { id, customer_id: customerId },
      fields: defaultStoreRetrieveOrderSetFields
    }
  })

  const order_set = data[0]
  if (!order_set) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order set with id: ${id} was not found`
    )
  }

  res.json({
    order_set
  })
}
