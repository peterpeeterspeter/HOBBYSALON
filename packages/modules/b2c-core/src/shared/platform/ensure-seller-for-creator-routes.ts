import { MedusaError } from "@medusajs/framework/utils";

import { SellerType } from "@mercurjs/framework";

const ALLOWED_SELLER_TYPES = new Set<string>([
  SellerType.CREATOR,
  SellerType.MERCHANT,
]);

type SellerRow = {
  id: string;
  seller_type: string | null;
};

export async function ensureSellerForCreatorRoutes(
  knex: any,
  sellerId: string
): Promise<SellerRow> {
  const seller = (await knex("seller")
    .select("id", "seller_type")
    .where("id", sellerId)
    .whereNull("deleted_at")
    .first()) as SellerRow | undefined;

  if (
    !seller?.seller_type ||
    !ALLOWED_SELLER_TYPES.has(seller.seller_type)
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Creator seller ${sellerId} not found`
    );
  }

  return seller;
}
