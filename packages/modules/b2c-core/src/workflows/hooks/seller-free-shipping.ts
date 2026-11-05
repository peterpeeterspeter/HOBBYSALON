import { Modules } from '@medusajs/framework/utils';
import { StepResponse } from '@medusajs/framework/workflows-sdk';
import {
  refreshCartItemsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow
} from '@medusajs/medusa/core-flows';
import { assertShippingCartMutable } from '../../shared/shipping/data';

// Reset the native base before Medusa snapshots the cart for promotion allocation.
// Otherwise a previously free method (0) makes shipping promotions disappear on
// the first refresh below the threshold. Both writes have workflow compensation.
refreshCartItemsWorkflow.hooks.setPricingContext(
  async ({ cart_id }, { container }) => {
    const state = await assertShippingCartMutable(container, cart_id);
    const methods = state.policies.length ? state.cart.shipping_methods : [];
    const backup = {
      methods: [] as { id: string; amount: any; is_tax_inclusive: boolean }[],
      adjustments: [] as string[]
    };
    if (methods.length) {
      const { result: options } =
        await listShippingOptionsForCartWithPricingWorkflow(container).run({
          input: {
            cart_id,
            is_return: false,
            options: methods.map((m: any) => ({
              id: m.shipping_option_id,
              data: m.data
            }))
          }
        });
      const updates = methods.flatMap((method: any) => {
        const price = options.find(
          (o) => o.id === method.shipping_option_id
        )?.calculated_price;
        if (price?.calculated_amount == null) return [];
        backup.methods.push({
          id: method.id,
          amount: method.amount,
          is_tax_inclusive: method.is_tax_inclusive
        });
        return [
          {
            id: method.id,
            amount: price.calculated_amount,
            is_tax_inclusive: !!price.is_calculated_price_tax_inclusive
          }
        ];
      });
      if (updates.length) {
        try {
          await container.resolve(Modules.CART).updateShippingMethods(updates);
        } catch (error) {
          await restore(backup, container);
          throw error;
        }
      }
    }
    return new StepResponse({}, backup);
  },
  async (backup, { container }) => restore(backup, container)
);

type Backup = { methods: { id: string; amount: any }[]; adjustments: string[] };
async function restore(backup: Backup | undefined, container: any) {
  if (!backup) return;
  const cart = container.resolve(Modules.CART);
  if (backup.methods.length) await cart.updateShippingMethods(backup.methods);
  if (backup.adjustments.length)
    await cart.restoreShippingMethodAdjustments(backup.adjustments);
}
refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection(
  async ({ input }, { container }) => {
    const state = await assertShippingCartMutable(container, input.cart_id);
    const freeIds = new Set(
      state.summaries
        .filter(
          (s) =>
            s.available &&
            s.qualified &&
            s.country_code ===
              state.cart.shipping_address?.country_code?.toLowerCase()
        )
        .flatMap((s) => s.shipping_option_ids)
    );
    const methods = state.cart.shipping_methods.filter((m: any) =>
      freeIds.has(m.shipping_option_id)
    );
    const backup: Backup = {
      methods: methods.map((m: any) => ({ id: m.id, amount: m.amount })),
      adjustments: methods.flatMap((m: any) =>
        (m.adjustments ?? []).map((a: any) => a.id)
      )
    };
    const cart = container.resolve(Modules.CART);
    try {
      if (backup.adjustments.length)
        await cart.softDeleteShippingMethodAdjustments(backup.adjustments);
      if (methods.length)
        await cart.updateShippingMethods(
          methods.map((m: any) => ({ id: m.id, amount: 0 }))
        );
    } catch (error) {
      await restore(backup, container);
      throw error;
    }
    return new StepResponse(undefined, backup);
  },
  async (backup, { container }) => restore(backup, container)
);
