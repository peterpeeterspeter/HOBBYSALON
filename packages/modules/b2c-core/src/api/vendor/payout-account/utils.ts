import { MedusaContainer } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'

import { resolveSellerPayoutAccountRelation } from '../../../shared/utils/resolve-seller-payout-account'

export const refetchPayoutAccount = async (
  container: MedusaContainer,
  fields: string[],
  filters: Record<string, unknown>
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const sellerId = filters.seller_id

  if (typeof sellerId !== 'string' || !sellerId.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'seller_id is required to resolve payout account'
    )
  }

  const relation = await resolveSellerPayoutAccountRelation(
    query,
    sellerId,
    ['payout_account_id', ...fields]
  )

  if (!relation?.payout_account) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Payout account is not connected to the seller'
    )
  }

  return {
    payout_account: relation.payout_account,
  }
}
