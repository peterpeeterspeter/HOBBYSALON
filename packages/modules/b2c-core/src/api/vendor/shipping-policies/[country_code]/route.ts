import type SellerModuleService from '../../../../modules/seller/service';
import {
  AuthenticatedMedusaRequest,
  MedusaResponse
} from '@medusajs/framework';
import { fetchSellerByAuthActorId } from '../../../../shared/infra/http/utils';
import {
  sellerOptions,
  optionServesCountry,
  invalid
} from '../../../../shared/shipping/data';
import { parseThreshold } from '../../../../shared/shipping/policy';
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const seller = await fetchSellerByAuthActorId(
    req.auth_context.actor_id,
    req.scope
  );
  const country = req.params.country_code;
  if (!['be', 'nl'].includes(country)) invalid('Kies België of Nederland');
  const body = req.body as Record<string, unknown>;
  if (
    !body ||
    Object.keys(body).some(
      (k) => !['free_shipping_threshold', 'shipping_option_ids'].includes(k)
    )
  )
    invalid('Ongeldige verzendinstellingen');
  let threshold: number | null;
  try {
    threshold = parseThreshold(body.free_shipping_threshold);
  } catch (e) {
    return invalid((e as Error).message);
  }
  if (
    !Array.isArray(body.shipping_option_ids) ||
    body.shipping_option_ids.some((id) => typeof id !== 'string') ||
    body.shipping_option_ids.length > 100
  )
    invalid('Kies geldige verzendmethodes');
  const ids = [...new Set(body.shipping_option_ids as string[])];
  if (threshold !== null && !ids.length)
    invalid('Kies minstens één standaardbezorgmethode');
  const options = await sellerOptions(req.scope, [seller.id]);
  if (
    ids.some(
      (id) =>
        !options.some(
          (l: any) =>
            l.shipping_option.id === id && optionServesCountry(l, country)
        )
    )
  )
    invalid(
      'Een verzendmethode is niet beschikbaar voor jouw winkel en dit land'
    );
  const service = req.scope.resolve<SellerModuleService>('seller');
  const [existing] = await service.listSellerShippingPolicies({
    seller_id: seller.id,
    country_code: country
  });
  const data = {
    seller_id: seller.id,
    country_code: country as 'be' | 'nl',
    currency_code: 'eur',
    free_shipping_threshold: threshold,
    shipping_option_ids: ids
  };
  const policy = existing
    ? await service.updateSellerShippingPolicies({ id: existing.id, ...data })
    : await service.createSellerShippingPolicies(data);
  res.json({ policy });
}
