import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CreatePayoutDTO, PayoutDTO } from "@mercurjs/framework";
import { PAYOUT_MODULE, PayoutModuleService } from "../../../modules/payout";

export const createPayoutStep = createStep(
  "create-payout",
  async (input: CreatePayoutDTO, { container }) => {
    const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    let payout: PayoutDTO | null = null;
    let err = false;
    let error_message: string | null = null;

    try {
      payout = await service.createPayout(input);
    } catch (error) {
      err = true;
      error_message =
        error instanceof Error
          ? error.message
          : "Error occured while creating payout";

      logger.error(
        `Payout creation failed for order ${input.transaction_id} (account ${input.account_id}): ${error_message}`
      );
    }

    return new StepResponse({
      payout,
      err,
      error_message,
    });
  }
);
