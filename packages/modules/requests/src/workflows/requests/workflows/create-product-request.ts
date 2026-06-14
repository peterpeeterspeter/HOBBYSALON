import { createRemoteLinkStep } from "@medusajs/medusa/core-flows";
import {
  WorkflowResponse,
  WorkflowData,
  createHook,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";

import {
  CreateRequestDTO,
  ProductRequestUpdatedEvent,
  RequestUpdated,
  SELLER_MODULE,
  emitMultipleEventsStep,
} from "@mercurjs/framework";
import { REQUESTS_MODULE } from "../../../modules/requests";

import { createRequestStep } from "../steps";

type CreateProductRequestWorkflowInput = {
  data: CreateRequestDTO;
  seller_id: string;
  additional_data?: any;
};

export const createProductRequestWorkflow = createWorkflow(
  "create-product-request",
  function (input: WorkflowData<CreateProductRequestWorkflowInput>) {
    const request = createRequestStep(input.data);

    const link = transform({ request, input }, ({ request, input }) => {
      return [
        {
          [SELLER_MODULE]: {
            seller_id: input.seller_id,
          },
          [REQUESTS_MODULE]: {
            request_id: request[0].id,
          },
        },
      ];
    });

    createRemoteLinkStep(link);

    emitMultipleEventsStep([
      {
        name: RequestUpdated.CREATED,
        data: { ...input.data, sellerId: input.seller_id },
      },
      {
        name: ProductRequestUpdatedEvent.CREATED,
        data: { id: request[0].id },
      },
    ]);

    const productRequestCreatedHook = createHook("productRequestCreated", {
      requestId: request[0].id,
      sellerId: input.seller_id,
    });
    return new WorkflowResponse(request, {
      hooks: [productRequestCreatedHook] as any[],
    });
  }
);
