import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { PAYOUT_MODULE } from "@mercurjs/b2c-core/modules/payout";
import { SELLER_MODULE } from "@mercurjs/b2c-core/modules/seller";
import { PayoutAccountStatus } from "@mercurjs/framework";

import {
  listSellerPayoutAccountRelations,
  pickPreferredSellerPayoutAccount,
} from "../../../../packages/modules/b2c-core/src/shared/utils/resolve-seller-payout-account";

/**
 * Remove duplicate seller ↔ payout_account links when a newer active Connect
 * account exists. Prevents payout jobs from targeting stale Stripe accounts.
 *
 * Run:
 *   npx medusa exec ./src/scripts/fixes/fix-stale-payout-accounts.ts
 */

export default async function fixStalePayoutAccounts({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const sellerRows = await knex("seller_seller_payout_payout_account")
    .whereNull("deleted_at")
    .select("seller_id")
    .groupBy("seller_id")
    .havingRaw("count(*) > 1");

  if (!sellerRows.length) {
    console.log("No sellers with duplicate payout account links.");
    return;
  }

  for (const row of sellerRows) {
    const sellerId = row.seller_id as string;
    const relations = await listSellerPayoutAccountRelations(query, sellerId, [
      "payout_account_id",
      "payout_account.id",
      "payout_account.status",
      "payout_account.reference_id",
      "payout_account.updated_at",
    ]);

    const preferred = pickPreferredSellerPayoutAccount(relations);
    if (!preferred) continue;

    const stale = relations.filter(
      (relation) => relation.payout_account_id !== preferred.payout_account_id
    );

    for (const relation of stale) {
      const status =
        relation.payout_account?.status ?? PayoutAccountStatus.DISABLED;

      if (
        preferred.payout_account?.status === PayoutAccountStatus.ACTIVE &&
        status !== PayoutAccountStatus.ACTIVE
      ) {
        await link.dismiss([
          {
            [SELLER_MODULE]: { seller_id: sellerId },
            [PAYOUT_MODULE]: {
              payout_account_id: relation.payout_account_id,
            },
          },
        ]);

        console.log(
          `Dismissed stale payout link for seller ${sellerId}: ${relation.payout_account_id} (${status}) → keeping ${preferred.payout_account_id}`
        );
      }
    }
  }
}
