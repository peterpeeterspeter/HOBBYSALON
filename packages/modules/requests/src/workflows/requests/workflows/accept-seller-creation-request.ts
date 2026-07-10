import { WorkflowResponse, WorkflowData, createWorkflow } from "@medusajs/workflows-sdk";

import { AcceptRequestDTO } from "@mercurjs/framework";

import { updateRequestWorkflow } from "./update-request";

export const acceptSellerCreationRequestWorkflow = createWorkflow(
  "accept-seller-creation-request",
  function (input: WorkflowData<AcceptRequestDTO>) {
    updateRequestWorkflow.runAsStep({ input });
    return new WorkflowResponse({});
  }
);
