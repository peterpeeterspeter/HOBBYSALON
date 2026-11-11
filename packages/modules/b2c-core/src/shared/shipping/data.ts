import {
  ContainerRegistrationKeys,
  MedusaError
} from '@medusajs/framework/utils';
import sellerProduct from '../../links/seller-product';
import sellerOption from '../../links/seller-shipping-option';
import { evaluateShippingPolicy, ShippingPolicy } from './policy';

export const optionFields = [
  'shipping_option.id',
  'shipping_option.name',
  'shipping_option.price_type',
  'shipping_option.shipping_profile_id',
  'shipping_option.shipping_profile.name',
  'shipping_option.type.*',
  'shipping_option.rules.*',
  'shipping_option.prices.*',
  'shipping_option.service_zone.geo_zones.*',
  'shipping_option.service_zone.fulfillment_set.type',
  'shipping_option.provider.is_enabled',
  'seller_id',
  'seller.store_status'
];
export const invalid = (message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
};
export function optionServesCountry(link: any, country: string): boolean {
  const o = link.shipping_option;
  return (
    link.seller?.store_status === 'ACTIVE' &&
    o?.price_type === 'flat' &&
    o.provider?.is_enabled !== false &&
    // The legacy portal created placeholder type-code methods. Selecting one
    // explicitly in this policy designates it as standard delivery.
    ['standard', 'type-code'].includes(o.type?.code) &&
    o.service_zone?.fulfillment_set?.type === 'shipping' &&
    !o.rules?.some(
      (r: any) =>
        (r.attribute === 'is_return' && String(r.value) === 'true') ||
        (r.attribute === 'enabled_in_store' && String(r.value) === 'false')
    ) &&
    o.service_zone?.geo_zones?.some(
      (g: any) =>
        g.type === 'country' && g.country_code?.toLowerCase() === country
    ) &&
    o.prices?.some(
      (p: any) =>
        p.currency_code === 'eur' &&
        Number.isFinite(Number(p.amount)) &&
        Number(p.amount) >= 0
    )
  );
}
export async function sellerOptions(container: any, sellerIds: string[]) {
  if (!sellerIds.length) return [];
  return (
    await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: sellerOption.entryPoint,
      fields: optionFields,
      filters: { seller_id: sellerIds }
    })
  ).data.filter((link: any) => link.shipping_option?.id);
}
export async function cartShippingState(container: any, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [cart]
  } = await query.graph({
    entity: 'cart',
    filters: { id: cartId },
    fields: [
      'id',
      'currency_code',
      // Requesting a cart total makes Medusa decorate item totals with discounts and tax.
      'total',
      'completed_at',
      'shipping_address.*',
      'items.*',
      'items.tax_lines.*',
      'items.adjustments.*',
      'promotions.code',
      'shipping_methods.*',
      'shipping_methods.adjustments.*',
      'payment_collection.payment_sessions.*'
    ]
  });
  if (!cart)
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Winkelwagen niet gevonden'
    );
  const ids = [
    ...new Set(cart.items.map((i: any) => i.product_id).filter(Boolean))
  ];
  const { data: links } = ids.length
    ? await query.graph({
        entity: sellerProduct.entryPoint,
        filters: { product_id: ids },
        fields: [
          'product_id',
          'seller_id',
          'product.shipping_profile.id',
          'seller.name'
        ]
      })
    : { data: [] };
  const sellerIds = [...new Set<string>(links.map((l: any) => l.seller_id))];
  const policies: ShippingPolicy[] = sellerIds.length
    ? await container
        .resolve('seller')
        .listSellerShippingPolicies({ seller_id: sellerIds }, { take: null })
    : [];
  const options = policies.length
    ? await sellerOptions(container, sellerIds)
    : [];
  if (!policies.length)
    return {
      cart,
      policies,
      summaries: [],
      frozen:
        !!cart.completed_at ||
        !!cart.payment_collection?.payment_sessions?.length
    };
  const items = cart.items.map((item: any) => {
    const matches = links.filter((l: any) => l.product_id === item.product_id);
    if (matches.length !== 1)
      invalid('De verkoper van een product kon niet worden gecontroleerd');
    return {
      ...item,
      seller_id: matches[0].seller_id,
      shipping_profile_id: matches[0].product.shipping_profile?.id
    };
  });
  const frozen =
    !!cart.completed_at || !!cart.payment_collection?.payment_sessions?.length;
  const countries = cart.shipping_address?.country_code
    ? [cart.shipping_address.country_code.toLowerCase()]
    : ['be', 'nl'];
  const summaries = policies
    .filter(
      (p) =>
        countries.includes(p.country_code) && p.free_shipping_threshold !== null
    )
    .map((p) => {
      const eligible = options.filter(
        (l: any) =>
          l.seller_id === p.seller_id &&
          Array.isArray(p.shipping_option_ids) &&
          p.shipping_option_ids.includes(l.shipping_option.id) &&
          optionServesCountry(l, p.country_code)
      );
      const sellerItems = items.filter(
        (i: any) => i.seller_id === p.seller_id && i.requires_shipping !== false
      );
      const covered =
        sellerItems.length > 0 &&
        sellerItems.every((i: any) =>
          eligible.some(
            (l: any) =>
              l.shipping_option.shipping_profile_id === i.shipping_profile_id
          )
        );
      return {
        ...evaluateShippingPolicy(p, items, p.country_code, cart.currency_code),
        seller_name: links.find((l: any) => l.seller_id === p.seller_id)?.seller
          ?.name,
        available: covered,
        shipping_option_ids: covered
          ? eligible.map((l: any) => l.shipping_option.id)
          : []
      };
    });
  return { cart, policies, summaries, frozen };
}
export async function assertShippingCartMutable(
  container: any,
  cartId: string
) {
  const state = await cartShippingState(container, cartId);
  if (state.frozen && state.policies.length)
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      'Je betaling is al gestart. Rond die af voordat je de verzending wijzigt.'
    );
  return state;
}
