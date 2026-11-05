import type SellerModuleService from '../../../modules/seller/service';
import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from '@medusajs/framework';
import { fetchSellerByAuthActorId } from '../../../shared/infra/http/utils';
import {
  sellerOptions,
  optionServesCountry
} from '../../../shared/shipping/data';
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const seller = await fetchSellerByAuthActorId(
    req.auth_context.actor_id,
    req.scope
  );
  const policies = await req.scope
    .resolve<SellerModuleService>('seller')
    .listSellerShippingPolicies({ seller_id: seller.id });
  const options = await sellerOptions(req.scope, [seller.id]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    policies,
    options: ['be', 'nl'].flatMap((country_code) =>
      options
        .filter((l: any) => optionServesCountry(l, country_code))
        .map((l: any) => ({
          country_code,
          id: l.shipping_option.id,
          name: l.shipping_option.name,
          shipping_profile_name: l.shipping_option.shipping_profile?.name,
          prices: l.shipping_option.prices
            .filter((p: any) => p.currency_code === 'eur')
            .map((p: any) => ({
              amount: Number(p.amount),
              currency_code: p.currency_code
            }))
        }))
    )
  });
}
