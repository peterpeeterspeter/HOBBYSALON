import type SellerModuleService from '../../../../../modules/seller/service';
import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import sellerProduct from '../../../../../links/seller-product';
import {
  optionServesCountry,
  sellerOptions
} from '../../../../../shared/shipping/data';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { data: links } = await req.scope
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({
      entity: sellerProduct.entryPoint,
      fields: [
        'seller_id',
        'product.shipping_profile.id',
        'product.status',
        'seller.name'
      ],
      filters: { product_id: req.params.id }
    });
  const link = links.length === 1 ? links[0] : null;
  if (!link || link.product.status !== 'published')
    return res.json({ shipping_policies: [] });
  const policies = await req.scope
    .resolve<SellerModuleService>('seller')
    .listSellerShippingPolicies({ seller_id: link.seller_id });
  const options = await sellerOptions(req.scope, [link.seller_id]);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    shipping_policies: policies
      .filter(
        (p: any) =>
          p.free_shipping_threshold !== null &&
          options.some(
            (l: any) =>
              Array.isArray(p.shipping_option_ids) &&
              p.shipping_option_ids.includes(l.shipping_option.id) &&
              l.shipping_option.shipping_profile_id ===
                link.product.shipping_profile?.id &&
              optionServesCountry(l, p.country_code)
          )
      )
      .map((p: any) => ({
        seller_id: link.seller_id,
        seller_name: link.seller.name,
        country_code: p.country_code,
        threshold_amount: Number(p.free_shipping_threshold)
      }))
  });
}
