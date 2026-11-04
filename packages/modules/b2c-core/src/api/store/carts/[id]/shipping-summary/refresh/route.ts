import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { withCommerceCartLock } from '../../../../../../utils/commerce-cart-lock';
import { refreshUnpaidShipping } from '../../../../../../shared/shipping/refresh';
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const state = await withCommerceCartLock(req.scope, req.params.id, () =>
    refreshUnpaidShipping(req.scope, req.params.id)
  );
  res.json({ payment_frozen: state.frozen });
}
