import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

import {
  AdminUpdateOrderReturnRequestDTO,
  OrderReturnRequestDTO,
  VendorUpdateOrderReturnRequestDTO,
} from "@mercurjs/framework";
import {
  ORDER_RETURN_MODULE,
  OrderReturnModuleService,
} from "../../../modules/order-return-request";

type UpdateOrderReturnRequestInput =
  | VendorUpdateOrderReturnRequestDTO
  | AdminUpdateOrderReturnRequestDTO;

export const updateOrderReturnRequestStep = createStep<
  UpdateOrderReturnRequestInput,
  OrderReturnRequestDTO,
  OrderReturnRequestDTO
>(
  "update-order-return-request",
  async (
    input,
    { container }
  ): Promise<StepResponse<OrderReturnRequestDTO, OrderReturnRequestDTO>> => {
    const service =
      container.resolve<OrderReturnModuleService>(ORDER_RETURN_MODULE);

    const previousData = (await service.retrieveOrderReturnRequest(
      input.id
    )) as OrderReturnRequestDTO;

    const request = (await service.updateOrderReturnRequests(
      input
    )) as OrderReturnRequestDTO;

    return new StepResponse(request, previousData);
  },
  async (previousData, { container }) => {
    if (!previousData) {
      return;
    }

    const service =
      container.resolve<OrderReturnModuleService>(ORDER_RETURN_MODULE);

    await service.updateOrderReturnRequests(
      previousData as UpdateOrderReturnRequestInput
    );
  }
);
