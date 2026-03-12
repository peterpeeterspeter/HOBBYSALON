import { createStep } from "@medusajs/framework/workflows-sdk";

import {
  REQUESTS_MODULE,
  RequestsModuleService,
} from "../../../modules/requests";
import { updateProductStatusWorkflow } from "@mercurjs/framework";
import { parseProductRequestData } from "../utils/request-data-schemas";

export const updateRelatedProductStatusStep = createStep(
  "update-related-product-status",
  async (id: string, { container }) => {
    const service = container.resolve<RequestsModuleService>(REQUESTS_MODULE);

    const request = await service.retrieveRequest(id);

    if (
      ["product", "product_update"].includes(request.type) &&
      request.status === "rejected"
    ) {
      const requestData = parseProductRequestData(request.data);

      await updateProductStatusWorkflow.run({
        container,
        input: {
          id: requestData.product_id,
          status: "rejected",
        },
      });
    }
  }
);
