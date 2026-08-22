import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

import { PayoutAccountStatus } from "@mercurjs/framework";

import { resolveSellerPayoutAccountRelation } from "../../../shared/utils/resolve-seller-payout-account";

export const resolveSellerPayoutAccountStep = createStep(
  "resolve-seller-payout-account",
  async (sellerId: string, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const relation = await resolveSellerPayoutAccountRelation(query, sellerId, [
      "payout_account_id",
      "payout_account.id",
      "payout_account.status",
      "payout_account.reference_id",
      "payout_account.data",
      "payout_account.created_at",
      "payout_account.updated_at",
    ]);

    if (!relation?.payout_account) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Seller has no payout account"
      );
    }

    if (relation.payout_account.status !== PayoutAccountStatus.ACTIVE) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Seller payout account is not active"
      );
    }

    return new StepResponse(relation.payout_account);
  }
);
