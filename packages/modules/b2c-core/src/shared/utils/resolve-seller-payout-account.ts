import { PayoutAccountStatus } from "@mercurjs/framework";

import sellerPayoutAccountLink from "../../links/seller-payout-account";

type QueryGraph = {
  graph: (config: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: SellerPayoutAccountRelation[] }>;
};

export type SellerPayoutAccountRelation = {
  id?: string;
  seller_id?: string;
  payout_account_id: string;
  payout_account?: {
    id: string;
    status: string;
    reference_id?: string;
    updated_at?: string | Date;
    created_at?: string | Date;
  };
};

const STATUS_RANK: Record<string, number> = {
  [PayoutAccountStatus.ACTIVE]: 0,
  [PayoutAccountStatus.PENDING]: 1,
  [PayoutAccountStatus.DISABLED]: 2,
};

function relationTimestamp(relation: SellerPayoutAccountRelation): number {
  const updated = relation.payout_account?.updated_at;
  if (!updated) return 0;
  return new Date(updated).getTime();
}

/** Prefer active Connect account; break ties by newest update. */
export function pickPreferredSellerPayoutAccount<
  T extends SellerPayoutAccountRelation,
>(relations: T[]): T | null {
  if (!relations.length) return null;

  return [...relations].sort((a, b) => {
    const statusA = a.payout_account?.status ?? PayoutAccountStatus.DISABLED;
    const statusB = b.payout_account?.status ?? PayoutAccountStatus.DISABLED;
    const rankDiff =
      (STATUS_RANK[statusA] ?? 9) - (STATUS_RANK[statusB] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    return relationTimestamp(b) - relationTimestamp(a);
  })[0];
}

export async function listSellerPayoutAccountRelations(
  query: QueryGraph,
  sellerId: string,
  fields: string[] = [
    "id",
    "seller_id",
    "payout_account_id",
    "payout_account.id",
    "payout_account.status",
    "payout_account.reference_id",
    "payout_account.updated_at",
    "payout_account.created_at",
  ]
): Promise<SellerPayoutAccountRelation[]> {
  const { data } = await query.graph({
    entity: sellerPayoutAccountLink.entryPoint,
    fields,
    filters: { seller_id: sellerId },
  });

  return data ?? [];
}

export async function resolveSellerPayoutAccountRelation(
  query: QueryGraph,
  sellerId: string,
  fields?: string[]
): Promise<SellerPayoutAccountRelation | null> {
  const relations = await listSellerPayoutAccountRelations(
    query,
    sellerId,
    fields
  );
  return pickPreferredSellerPayoutAccount(relations);
}
