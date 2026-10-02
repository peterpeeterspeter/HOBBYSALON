import { when } from '@medusajs/framework/workflows-sdk'
import { createWorkflow } from '@medusajs/workflows-sdk'

import {
  PayoutWebhookAction,
  PayoutWebhookActionAndDataResponse
} from '@mercurjs/framework'

import { syncPayoutAccountFromStripeStep } from '../steps/sync-payout-account-from-stripe'

type ProcessPayoutWebhookActionInput = {
  action: PayoutWebhookActionAndDataResponse['action']
  data: PayoutWebhookActionAndDataResponse['data']
}

export const processPayoutWebhookActionWorkflow = createWorkflow(
  'process-payout-action',
  function (input: ProcessPayoutWebhookActionInput) {
    // Account capability updates: re-sync from Stripe. Do not force ACTIVE —
    // transfers must wait until recipient capabilities are actually ready.
    when(
      { action: input.action },
      ({ action }) => action === PayoutWebhookAction.ACCOUNT_AUTHORIZED
    ).then(() => {
      syncPayoutAccountFromStripeStep({
        id: input.data.account_id
      })
    })
  }
)
