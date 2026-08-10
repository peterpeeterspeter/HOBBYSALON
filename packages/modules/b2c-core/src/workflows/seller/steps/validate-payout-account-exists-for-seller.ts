import {
  ContainerRegistrationKeys,
  MedusaError
} from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { resolveSellerPayoutAccountRelation } from '../../../shared/utils/resolve-seller-payout-account'

export const validatePayoutAccountExistsForSellerStep = createStep(
  'validate-payout-account-exists-for-seller',
  async (sellerId: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const relation = await resolveSellerPayoutAccountRelation(query, sellerId, [
      'id',
      'payout_account_id',
      'payout_account.status',
    ])

    if (!relation) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        'No payment account exists for seller'
      )
    }

    return new StepResponse({
      id: relation.payout_account_id
    })
  }
)
