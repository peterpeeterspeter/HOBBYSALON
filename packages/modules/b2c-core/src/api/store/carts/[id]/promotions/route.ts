import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StoreAddCartPromotionsType } from "@medusajs/medusa/api/store/carts/validators"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"
import { assertShippingCartMutable } from "../../../../../shared/shipping/data"
import { validateSellersPromotions } from "../../../../../modules/seller"

export const POST = async (
    req: AuthenticatedMedusaRequest<StoreAddCartPromotionsType>,
    res: MedusaResponse
  ) => {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const validatePromotions = await validateSellersPromotions(
      req.validatedBody.promo_codes,
      req.scope,
      req.params.id
    )
    if (!validatePromotions.valid) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Some of the promotion codes are invalid')
    }
    // Keep promotions, shipping and the payment total in one compensating workflow.
    const state = await assertShippingCartMutable(req.scope, req.params.id)
    const existingCodes = state.cart.promotions?.map((p: any) => p.code).filter(Boolean) ?? []
    const promoCodes = req.validatedBody.promo_codes.length
      ? [...new Set([...existingCodes, ...req.validatedBody.promo_codes])]
      : []
    await refreshCartItemsWorkflow(req.scope).run({ input: { cart_id: req.params.id, promo_codes: promoCodes } })
    const {
      data: [cart]
    } = await query.graph({
      entity: 'cart',
      filters: {
        id: req.params.id
      },
      fields: req.queryConfig.fields
    })
    res.json({ cart })
  }