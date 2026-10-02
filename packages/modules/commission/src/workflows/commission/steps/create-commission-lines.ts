import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

import {
  CommissionModuleService,
  COMMISSION_MODULE,
} from "../../../modules/commission";
import { CreateCommissionLineDTO } from "@mercurjs/framework";

export const createCommissionLinesStep = createStep(
  "create-commission-lines",
  async (input: CreateCommissionLineDTO[], { container }) => {
    const service = container.resolve(
      COMMISSION_MODULE
    ) as CommissionModuleService;

    if (!input.length) {
      return new StepResponse([]);
    }

    const itemLineIds = input.map((line) => line.item_line_id);
    const existing = await service.listCommissionLines({
      item_line_id: itemLineIds,
    });
    const existingIds = new Set(existing.map((line) => line.item_line_id));
    const toCreate = input.filter(
      (line) => !existingIds.has(line.item_line_id)
    );

    if (!toCreate.length) {
      return new StepResponse(existing);
    }

    // @ts-expect-error BigNumber incompatible interface
    const created = await service.createCommissionLines(toCreate);

    return new StepResponse([...(existing ?? []), ...(created ?? [])]);
  }
);
