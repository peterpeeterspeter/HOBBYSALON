import { ProductStatus } from "@medusajs/framework/utils";
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
  ProductUpdateRequestUpdatedEvent,
  RequestStatus,
  RequestUpdated,
  SELLER_MODULE,
  updateProductStatusStep,
  emitMultipleEventsStep,
} from "@mercurjs/framework";
import { REQUESTS_MODULE } from "../../../modules/requests";

import { createRequestStep } from "../steps";
import { parseProductUpdateRequestData } from "../utils/request-data-schemas";

type CreateProductUpdateRequestWorkflowInput = {
  data: CreateRequestDTO;
  seller_id: string;
  additional_data?: unknown;
};

export const createProductUpdateRequestWorkflow = createWorkflow(
  "create-product-update-request",
  function (input: WorkflowData<CreateProductUpdateRequestWorkflowInput>) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductUpdateRequestData(input.data.data)
    );

    updateProductStatusStep(
      transform({ requestData }, ({ requestData }) => ({
        id: requestData.product_id,
        status: ProductStatus.PROPOSED,
      }))
    );

    const requestPayload = transform({ input }, ({ input }) => ({
      ...input.data,
      data: {
        ...requestData,
        product_id: requestData.product_id,
      },
      type: "product_update",
      status: "pending" as RequestStatus,
    }));

    const request = createRequestStep(requestPayload);

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
        data: {
          ...input.data,
          sellerId: input.seller_id,
        },
      },
      {
        name: ProductUpdateRequestUpdatedEvent.CREATED,
        data: { id: request[0].id },
      },
    ]);

    const productUpdateRequestCreatedHook = createHook(
      "productUpdateRequestCreated",
      {
        requestId: request[0].id,
        sellerId: input.seller_id,
      }
    );
    return new WorkflowResponse(request, {
      hooks: [productUpdateRequestCreatedHook] as any[],
    });
  }
);
