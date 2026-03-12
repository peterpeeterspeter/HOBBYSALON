import { randomUUID } from 'node:crypto'

import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError,
  toHandle,
} from '@medusajs/framework/utils'
import { z } from 'zod'

import { MemberRole } from '@mercurjs/framework'

import { SELLER_MODULE, SellerModuleService } from '../../../../../../../modules/seller'

const RegisterMerchantPayload = z.object({
  name: z.string().trim().min(1),
  contact_name: z.string().trim().optional().nullable(),
  email: z.string().trim().email(),
  description: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address_line: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  postal_code: z.string().trim().optional().nullable(),
  country_code: z.string().trim().optional().nullable(),
  tax_id: z.string().trim().optional().nullable(),
})

const normalizeNullable = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const buildUniqueHandle = async (
  knex: any,
  name: string
): Promise<string> => {
  const base = toHandle(name) || `merchant-${randomUUID().slice(0, 8)}`
  const safeBase = base.slice(0, 64)

  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? '' : `-${i + 1}`
    const candidate = `${safeBase}${suffix}`.slice(0, 80)

    const exists = await knex('seller')
      .select('id')
      .where('handle', candidate)
      .whereNull('deleted_at')
      .first()

    if (!exists) {
      return candidate
    }
  }

  return `${safeBase}-${Date.now()}`.slice(0, 80)
}

/**
 * @oas [post] /admin/platform/materials/merchants/register
 * operationId: "AdminRegisterMerchantSeller"
 * summary: "Register Merchant Seller"
 * description: "Creates or returns a merchant seller with an owner member."
 * x-authenticated: true
 * tags:
 *   - Admin Platform
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = RegisterMerchantPayload.safeParse(req.body || {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    )
  }

  const payload = parsed.data
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const existing = await knex('seller')
    .select('id', 'seller_type', 'name', 'email', 'handle')
    .where('email', payload.email.toLowerCase())
    .whereNull('deleted_at')
    .first()

  if (existing) {
    if (existing.seller_type !== 'merchant') {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Seller with email ${payload.email} already exists as ${existing.seller_type}.`
      )
    }

    res.json({
      merchant: {
        seller_id: existing.id,
        seller_type: existing.seller_type,
        status: 'existing',
      },
    })
    return
  }

  const sellerService = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const handle = await buildUniqueHandle(knex, payload.name)

  const seller = await sellerService.createSellers({
    name: payload.name,
    handle,
    seller_type: 'merchant',
    description: normalizeNullable(payload.description),
    email: payload.email.toLowerCase(),
    phone: normalizeNullable(payload.phone),
    address_line: normalizeNullable(payload.address_line),
    city: normalizeNullable(payload.city),
    state: normalizeNullable(payload.state),
    postal_code: normalizeNullable(payload.postal_code),
    country_code: normalizeNullable(payload.country_code) ?? 'BE',
    tax_id: normalizeNullable(payload.tax_id),
  })

  await sellerService.createMembers({
    seller_id: seller.id,
    role: MemberRole.OWNER,
    email: payload.email.toLowerCase(),
    name: normalizeNullable(payload.contact_name) ?? payload.name,
  })

  await sellerService.createSellerOnboardings({
    seller_id: seller.id,
  })

  res.status(201).json({
    merchant: {
      seller_id: seller.id,
      seller_type: seller.seller_type,
      status: 'created',
    },
  })
}
