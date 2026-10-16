import { NextFunction } from 'express'

import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'
import {
  ContainerRegistrationKeys,
  MedusaError
} from '@medusajs/framework/utils'
import { LinkMethodRequest } from '@medusajs/framework/types'

type CheckResourceOwnershipByResourceIdOptions<Body> = {
  entryPoint: string
  filterField?: string
  resourceId?: (req: AuthenticatedMedusaRequest<Body>) => string | string[]
}

type CheckResourcesOwnershipByResourceBatchOptions<Body> = {
  entryPoint: string
  filterField?: string
  resourceIds?: (req: AuthenticatedMedusaRequest<Body>) => { add: string[], remove: string[] }
}

/**
 * Middleware that verifies if the authenticated member owns/has access to the requested resource(s).
 * This is done by checking if the member's seller ID matches the resource's seller ID.
 * Supports both single resource ID and arrays of resource IDs.
 *
 * @param options - Configuration options for the ownership check
 * @param options.entryPoint - The entity type to verify ownership of (e.g. 'seller_product', 'service_zone')
 * @param options.filterField - Field used to filter/lookup the resource (defaults to 'id')
 * @param options.resourceId - Function to extract resource ID(s) from the request (defaults to req.params.id)
 *
 * @throws {MedusaError} If the member does not own any of the resources
 *
 * @example
 * // Basic usage - check ownership of single vendor product
 * app.use(checkResourceOwnershipByResourceId({
 *   entryPoint: 'seller_product'
 * }))
 *
 * @example
 * // Custom field usage - check ownership of service zone
 * app.use(checkResourceOwnershipByResourceId({
 *   entryPoint: 'service_zone',
 *   filterField: 'service_zone_id',
 *   resourceId: (req) => req.params.zone_id
 * }))
 *
 * @example
 * // Batch usage - check ownership of multiple promotions
 * app.use(checkResourceOwnershipByResourceId({
 *   entryPoint: 'seller_promotion',
 *   filterField: 'promotion_id',
 *   resourceId: (req) => [...(req.body.add || []), ...(req.body.remove || [])]
 * }))
 */
export const checkResourceOwnershipByResourceId = <Body>({
  entryPoint,
  filterField = 'id',
  resourceId = (req) => req.params.id
}: CheckResourceOwnershipByResourceIdOptions<Body>) => {
  return async (
    req: AuthenticatedMedusaRequest<Body>,
    res: MedusaResponse,
    next: NextFunction
  ) => {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [member]
    } = await query.graph(
      {
        entity: 'member',
        fields: ['seller.id'],
        filters: {
          id: req.auth_context.actor_id
        }
      },
      { throwIfKeyNotFound: true }
    )

    const ids = resourceId(req)
    const idArray = Array.isArray(ids) ? ids : [ids]

    if (idArray.length === 0) {
      next()
      return
    }

    const { data: resources } = await query.graph({
      entity: entryPoint,
      fields: ['seller_id'],
      filters: {
        [filterField]: idArray,
        seller_id: member.seller.id
      }
    })

    if (resources.length !== idArray.length) {
      res.status(403).json({
        message: 'You are not allowed to perform this action',
        type: MedusaError.Types.NOT_ALLOWED
      })
      return
    }

    next()
  }
}

export const checkResourcesOwnershipByResourceBatch = ({
  entryPoint,
  filterField = 'id',
  resourceIds = (req) => ({
    add: req.validatedBody?.add === undefined ? [] : req.validatedBody.add,
    remove: req.validatedBody?.remove === undefined ? [] : req.validatedBody.remove
  })
}: CheckResourcesOwnershipByResourceBatchOptions<LinkMethodRequest>) => {
  return async (
    req: AuthenticatedMedusaRequest<LinkMethodRequest>,
    res: MedusaResponse,
    next: NextFunction
  ) => {
    const deny = () => {
      res.status(403).json({
        message: 'You are not allowed to perform this action',
        type: MedusaError.Types.NOT_ALLOWED
      })
    }
    const actorId = req.auth_context?.actor_id
    if (typeof actorId !== 'string' || actorId.length === 0) {
      deny()
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const memberResult = await query.graph(
      {
        entity: 'member',
        fields: ['seller.id'],
        filters: { id: actorId }
      },
      { throwIfKeyNotFound: true }
    )
    const members = memberResult?.data
    const sellerId = Array.isArray(members) && members.length === 1
      ? members[0]?.seller?.id
      : undefined
    if (typeof sellerId !== 'string' || sellerId.length === 0) {
      deny()
      return
    }

    const batch = resourceIds(req)
    if (!batch || !Array.isArray(batch.add) || !Array.isArray(batch.remove)) {
      deny()
      return
    }
    const ids = [...batch.add, ...batch.remove]
    if (ids.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
      deny()
      return
    }
    const allResourceIds = [...new Set(ids)]
    // A no-op must still be authenticated and linked to a seller.
    if (allResourceIds.length === 0) {
      next()
      return
    }

    const resourceResult = await query.graph({
      entity: entryPoint,
      fields: ['seller_id', filterField],
      filters: {
        [filterField]: allResourceIds,
        seller_id: sellerId
      }
    })
    const resources = resourceResult?.data
    const requestedIds = new Set(allResourceIds)
    // Validate returned ownership too: a filter or row count is not proof.
    if (!Array.isArray(resources) || resources.some((resource) =>
      !resource || resource.seller_id !== sellerId ||
      !requestedIds.has(resource[filterField])
    )) {
      deny()
      return
    }
    const ownedIds = new Set(resources.map((resource) => resource[filterField]))
    if (!allResourceIds.every((id) => ownedIds.has(id))) {
      deny()
      return
    }

    next()
  }
}
