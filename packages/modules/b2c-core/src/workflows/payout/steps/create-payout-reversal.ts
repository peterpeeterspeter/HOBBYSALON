import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";
import { BigNumber, MathBN } from "@medusajs/framework/utils";

import { CreatePayoutReversalDTO } from "@mercurjs/framework";
import { PAYOUT_MODULE, PayoutModuleService } from "../../../modules/payout";

type CreatePayoutReversalStepInput = Omit<CreatePayoutReversalDTO, "payout_id"> & {
  payout_id: string | null;
};

export const createPayoutReversalStep = createStep(
  "create-payout-reversal",
  async (input: CreatePayoutReversalStepInput, { container }) => {
    if (input.payout_id === null) {
      return new StepResponse();
    }

    const amount = new BigNumber(input.amount);
    if (!Number.isFinite(amount.numeric) || MathBN.lt(amount, 0)) {
      throw new Error("Invalid payout reversal amount");
    }
    if (MathBN.eq(amount, 0)) {
      return new StepResponse();
    }
    if (typeof input.operation_id !== "string" || !input.operation_id.trim()) {
      throw new Error("Payout reversal requires a stable operation identity");
    }

    const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE);
    // A provider or persistence failure must fail the workflow, not resolve as
    // { err: true } that callers ignore. No compensating money movement here.
    const payoutReversal = await service.createPayoutReversal({
      ...input,
      payout_id: input.payout_id,
    });
    return new StepResponse({ payoutReversal, err: false });
  }
);
