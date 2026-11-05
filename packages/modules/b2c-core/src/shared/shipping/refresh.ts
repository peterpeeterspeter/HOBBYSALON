import { refreshCartItemsWorkflow } from '@medusajs/medusa/core-flows';
import { cartShippingState } from './data';
/** Call inside the existing commerce cart lock; never on payment recovery. */
export async function refreshUnpaidShipping(container: any, cartId: string) {
  const state = await cartShippingState(container, cartId);
  if (state.frozen || !state.policies.length) return state;
  await refreshCartItemsWorkflow(container).run({
    input: { cart_id: cartId, force_refresh: true }
  });
  return cartShippingState(container, cartId);
}
