import { model } from '@medusajs/framework/utils';

import { Seller } from './seller';

export const SellerShippingPolicy = model
  .define('seller_shipping_policy', {
    id: model.id({ prefix: 'ssp' }).primaryKey(),
    seller: model.belongsTo(() => Seller, { mappedBy: 'shipping_policies' }),
    country_code: model.enum(['be', 'nl']),
    currency_code: model.text().default('eur'),
    free_shipping_threshold: model.bigNumber().nullable(),
    shipping_option_ids: model.array().default([])
  })
  .indexes([
    {
      name: 'IDX_seller_shipping_policy_country',
      on: ['seller_id', 'country_code'],
      unique: true,
      where: 'deleted_at IS NULL'
    }
  ]);
