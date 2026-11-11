import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { cartShippingState } from '../../../../../shared/shipping/data';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { summaries, frozen } = await cartShippingState(
    req.scope,
    req.params.id
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    shipping_summary: summaries.map(
      ({ shipping_option_ids: _shipping_option_ids, ...summary }) => summary
    ),
    payment_frozen: frozen
  });
}
