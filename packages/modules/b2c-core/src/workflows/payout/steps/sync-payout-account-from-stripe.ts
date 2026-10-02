import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { PAYOUT_MODULE, PayoutModuleService } from '../../../modules/payout'

export const syncPayoutAccountFromStripeStep = createStep(
  'sync-payout-account-from-stripe',
  async (input: { id: string }, { container }) => {
    const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
    const previousData = await service.retrievePayoutAccount(input.id)
    const updated = await service.syncStripeAccount(input.id)
    return new StepResponse(updated, previousData)
  },
  async (previousData, { container }) => {
    if (!previousData) return
    const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
    await service.updatePayoutAccounts({
      id: previousData.id,
      status: previousData.status,
      data: previousData.data
    })
  }
)
