import {
  createProductsWorkflow,
  emitEventStep,
  parseProductCsvStep,
} from "@medusajs/medusa/core-flows";
import {
  WorkflowResponse,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";

import {
  ImportSellerProductsRequestUpdatedEvent,
  RequestStatus,
} from "@mercurjs/framework";

import { validateProductsToImportStep } from "../steps";

export const importSellerProductsWorkflow = createWorkflow(
  "import-seller-products",
  function (input: {
    file_content: string;
    seller_id: string;
    submitter_id: string;
    import_job_id?: string;
  }) {
    const products = parseProductCsvStep(input.file_content);
    const batchCreate = validateProductsToImportStep(products);

    const created = createProductsWorkflow.runAsStep({
      input: {
        products: batchCreate,
        additional_data: { seller_id: input.seller_id },
      },
    });

    const requestsPayload = transform(
      { created, input },
      ({ created, input }) => {
        return created.map((p, index) => ({
          data: {
            ...p,
            product_id: p.id,
            import_job_id: input.import_job_id,
            import_row_index: index + 1,
          },
          submitter_id: input.submitter_id,
          type: "product_import",
          status: "pending" as RequestStatus,
        }));
      }
    );

    const eventPayload = transform(
      { requestsPayload, input },
      ({ requestsPayload, input }) => ({
        request_payloads: requestsPayload,
        seller_id: input.seller_id,
        submitter_id: input.submitter_id,
      })
    );

    emitEventStep({
      eventName: ImportSellerProductsRequestUpdatedEvent.TO_CREATE,
      data: eventPayload,
    });

    return new WorkflowResponse(created);
  }
);
