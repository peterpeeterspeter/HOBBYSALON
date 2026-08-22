import {
  ContainerRegistrationKeys,
  MedusaError
} from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { PayoutAccountStatus } from '@mercurjs/framework'

import { listSellerPayoutAccountRelations } from '../../../shared/utils/resolve-seller-payout-account'

export const validateNoExistingPayoutAccountForSellerStep = createStep(
  'validate-no-existing-payout-account-for-seller',
  async (sellerId: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const relations = await listSellerPayoutAccountRelations(query, sellerId, [
      'id',
      'payout_account_id',
      'payout_account.status',
    ])

    if (relations.length === 0) {
      return new StepResponse(undefined)
    }

    const hasActive = relations.some(
      (relation) =>
        relation.payout_account?.status === PayoutAccountStatus.ACTIVE
    )

    if (hasActive) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        'An active payment account already exists for this seller'
      )
    }

    throw new MedusaError(
      MedusaError.Types.DUPLICATE_ERROR,
      'A payment account already exists for this seller. Complete Stripe onboarding on the existing account instead of creating a new one.'
    )
  }
)
