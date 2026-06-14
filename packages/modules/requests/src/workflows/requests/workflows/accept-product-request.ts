import {
  WorkflowResponse,
  WorkflowData,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";

import { AcceptRequestDTO, updateProductStatusStep } from "@mercurjs/framework";

import { updateRequestWorkflow } from "./update-request";
import { ProductStatus } from "@medusajs/framework/utils";
import { parseProductRequestData } from "../utils/request-data-schemas";

export const acceptProductRequestWorkflow = createWorkflow(
  "accept-product-request",
  function (input: WorkflowData<AcceptRequestDTO>) {
    const requestData = transform({ input }, ({ input }) =>
      parseProductRequestData(input.data)
    );

    const product = updateProductStatusStep({
      id: requestData.product_id,
      status: ProductStatus.PUBLISHED,
    });

    updateRequestWorkflow.runAsStep({ input });
    return new WorkflowResponse(product);
  }
);
