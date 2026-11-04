import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from '@medusajs/framework';
import {
  ContainerRegistrationKeys,
  MedusaError
} from '@medusajs/framework/utils';
import { POST as nativePost } from '@medusajs/medusa/api/store/payment-collections/[id]/payment-sessions/route';
import { withCommerceCartLock } from '../../../../../utils/commerce-cart-lock';
import { refreshUnpaidShipping } from '../../../../../shared/shipping/refresh';
export async function POST(
  req: AuthenticatedMedusaRequest<any, any>,
  res: MedusaResponse
) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const links = await knex('cart_payment_collection')
    .select('cart_id')
    .where({ payment_collection_id: req.params.id })
    .whereNull('deleted_at');
  if (!links.length) return nativePost(req, res);
  if (links.length !== 1) throw new Error('Ambiguous cart payment collection');
  return withCommerceCartLock(req.scope, links[0].cart_id, async () => {
    const state = await refreshUnpaidShipping(req.scope, links[0].cart_id);
    if (state.frozen && state.policies.length)
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        'Een bestaande betaling moet eerst worden afgerond of hersteld.'
      );
    return nativePost(req, res);
  });
}
