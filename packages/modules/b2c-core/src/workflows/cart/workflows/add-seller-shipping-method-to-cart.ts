import { createWorkflow, transform } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { addShippingMethodToCartWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows";
import sellerShippingOptionLink from "../../../links/seller-shipping-option";
import { validateCartShippingOptionsStep } from "../steps";

type Input = { cart_id: string; option: { id: string; data?: Record<string, any> } };
export const addSellerShippingMethodToCartWorkflow = createWorkflow("add-seller-shipping-method-to-cart", function(input: Input) {
  const { data: carts } = useQueryGraphStep({ entity: "cart", filters: { id: input.cart_id }, fields: ["id", "shipping_methods.*"], options: { throwIfKeyNotFound: true } }).config({ name: "cart-query" });
  const ids = transform({ carts, input }, ({ carts: [cart], input }) => [...new Set([...cart.shipping_methods.map(m => m.shipping_option_id), input.option.id])]);
  const { data: links } = useQueryGraphStep({ entity: sellerShippingOptionLink.entryPoint, fields: ["shipping_option_id", "seller_id"], filters: { shipping_option_id: ids } }).config({ name: "seller-shipping-option-query" });
  const final = transform({ carts, input, links }, ({ carts: [cart], input, links }) => {
    const owner = (id: string) => {
      const matches = links.filter(l => l.shipping_option_id === id);
      if (matches.length !== 1) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Onbekende verkoper voor verzendmethode");
      return matches[0].seller_id;
    };
    const seller = owner(input.option.id);
    return { cart_id: input.cart_id, options: [...cart.shipping_methods.filter(m => owner(m.shipping_option_id) !== seller).map(m => ({ id: m.shipping_option_id, data: m.data })), input.option] };
  });
  validateCartShippingOptionsStep(transform(final, value => ({ cart_id: value.cart_id, option_ids: value.options.map(o => o.id) })));
  addShippingMethodToCartWorkflow.runAsStep({ input: final });
});
