import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { PAYOUT_MODULE } from "@mercurjs/b2c-core/modules/payout";
import { SELLER_MODULE } from "@mercurjs/b2c-core/modules/seller";
import { PayoutAccountStatus } from "@mercurjs/framework";

type PayoutLinkRow = {
  payout_account_id: string;
  payout_account?: {
    id: string;
    status: string;
    updated_at?: string | Date;
  };
};

const STATUS_RANK: Record<string, number> = {
  [PayoutAccountStatus.ACTIVE]: 0,
  [PayoutAccountStatus.PENDING]: 1,
  [PayoutAccountStatus.DISABLED]: 2,
};

function pickPreferred(rows: PayoutLinkRow[]): PayoutLinkRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const statusA = a.payout_account?.status ?? PayoutAccountStatus.DISABLED;
    const statusB = b.payout_account?.status ?? PayoutAccountStatus.DISABLED;
    const rankDiff =
      (STATUS_RANK[statusA] ?? 9) - (STATUS_RANK[statusB] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    const updatedA = a.payout_account?.updated_at
      ? new Date(a.payout_account.updated_at).getTime()
      : 0;
    const updatedB = b.payout_account?.updated_at
      ? new Date(b.payout_account.updated_at).getTime()
      : 0;
    return updatedB - updatedA;
  })[0];
}

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
    const { data: relations } = await query.graph({
      entity: "seller_seller_payout_payout_account",
      fields: [
        "payout_account_id",
        "payout_account.id",
        "payout_account.status",
        "payout_account.reference_id",
        "payout_account.updated_at",
      ],
      filters: { seller_id: sellerId },
    });

    const preferred = pickPreferred((relations ?? []) as PayoutLinkRow[]);
    if (!preferred) continue;

    const stale = ((relations ?? []) as PayoutLinkRow[]).filter(
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
