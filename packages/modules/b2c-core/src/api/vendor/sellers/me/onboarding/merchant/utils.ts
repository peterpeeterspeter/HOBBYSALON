import { MedusaContainer } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { Knex } from 'knex'

import { fetchSellerByAuthActorId } from '../../../../../../shared/infra/http/utils'
import { recalculateOnboardingWorkflow } from '../../../../../../workflows/seller/workflows'

type OnboardingRow = {
  store_information: boolean
  stripe_connection: boolean
  locations_shipping: boolean
  products: boolean
}

type MerchantOnboardingStep = {
  key:
    | 'store_information'
    | 'stripe_connection'
    | 'locations_shipping'
    | 'category_mapping'
    | 'first_import_completed'
    | 'sync_tested'
  label: string
  required: boolean
  completed: boolean
}

const getStatus = (completedRequired: number, requiredTotal: number) => {
  if (requiredTotal <= 0 || completedRequired <= 0) {
    return 'not_started'
  }

  if (completedRequired >= requiredTotal) {
    return 'completed'
  }

  return 'in_progress'
}

const getProgressPercentage = (completedRequired: number, requiredTotal: number) => {
  if (!requiredTotal) {
    return 0
  }

  return Math.round((completedRequired / requiredTotal) * 100)
}

const createNextActions = (steps: MerchantOnboardingStep[]) => {
  const actions: string[] = []

  for (const step of steps) {
    if (!step.required || step.completed) {
      continue
    }

    switch (step.key) {
      case 'store_information':
        actions.push('Vul je winkelgegevens in onder Seller profiel')
        break
      case 'stripe_connection':
        actions.push('Koppel je payout account via Stripe Connect')
        break
      case 'locations_shipping':
        actions.push('Voeg minstens 1 stocklocatie en shipping setup toe')
        break
      case 'category_mapping':
        actions.push('Maak minstens 1 categorie -> domein mapping aan')
        break
      case 'first_import_completed':
        actions.push('Start en voltooi een eerste productimport')
        break
      default:
        break
    }
  }

  return actions
}

export const getMerchantOnboardingStatus = async (
  actorId: string,
  scope: MedusaContainer,
  options?: { recalculate?: boolean }
) => {
  const seller = await fetchSellerByAuthActorId(actorId, scope, [
    'id',
    'seller_type',
  ])

  if (!seller || seller.seller_type !== 'merchant') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Merchant onboarding is only available for merchant sellers'
    )
  }

  if (options?.recalculate) {
    await recalculateOnboardingWorkflow.run({
      container: scope,
      input: seller.id,
    })
  }

  const knex = scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

  const [onboarding, categoryMappingCountRow, importCountRow, syncCountRow] =
    await Promise.all([
      knex('seller_onboarding')
        .select(
          'store_information',
          'stripe_connection',
          'locations_shipping',
          'products'
        )
        .where('seller_id', seller.id)
        .whereNull('deleted_at')
        .first() as Promise<OnboardingRow | undefined>,
      knex('merchant_category_mapping')
        .where('seller_id', seller.id)
        .where('active', true)
        .whereNull('deleted_at')
        .count('* as count')
        .first() as Promise<{ count: string | number } | undefined>,
      knex('product_import_job')
        .where('seller_id', seller.id)
        .where('status', 'submitted')
        .whereNull('deleted_at')
        .count('* as count')
        .first() as Promise<{ count: string | number } | undefined>,
      knex('product_sync_job')
        .where('seller_id', seller.id)
        .whereIn('status', ['completed', 'completed_with_errors'])
        .whereNull('deleted_at')
        .count('* as count')
        .first() as Promise<{ count: string | number } | undefined>,
    ])

  const categoryMappingCount = Number.parseInt(
    String(categoryMappingCountRow?.count || 0),
    10
  )
  const importJobCount = Number.parseInt(String(importCountRow?.count || 0), 10)
  const syncJobCount = Number.parseInt(String(syncCountRow?.count || 0), 10)

  const steps: MerchantOnboardingStep[] = [
    {
      key: 'store_information',
      label: 'Store Information',
      required: true,
      completed: Boolean(onboarding?.store_information),
    },
    {
      key: 'stripe_connection',
      label: 'Stripe Connection',
      required: true,
      completed: Boolean(onboarding?.stripe_connection),
    },
    {
      key: 'locations_shipping',
      label: 'Locations & Shipping',
      required: true,
      completed: Boolean(onboarding?.locations_shipping),
    },
    {
      key: 'category_mapping',
      label: 'Category Mapping',
      required: true,
      completed: categoryMappingCount > 0,
    },
    {
      key: 'first_import_completed',
      label: 'First Import Completed',
      required: true,
      completed: importJobCount > 0,
    },
    {
      key: 'sync_tested',
      label: 'Sync Tested',
      required: false,
      completed: syncJobCount > 0,
    },
  ]

  const requiredSteps = steps.filter((step) => step.required)
  const completedRequired = requiredSteps.filter((step) => step.completed).length
  const requiredTotal = requiredSteps.length

  return {
    seller_id: seller.id,
    seller_type: seller.seller_type,
    status: getStatus(completedRequired, requiredTotal),
    progress_percentage: getProgressPercentage(completedRequired, requiredTotal),
    counts: {
      required_total: requiredTotal,
      required_completed: completedRequired,
      category_mappings: categoryMappingCount,
      submitted_import_jobs: importJobCount,
      completed_sync_jobs: syncJobCount,
    },
    steps,
    next_actions: createNextActions(steps),
    onboarding: onboarding || null,
  }
}
