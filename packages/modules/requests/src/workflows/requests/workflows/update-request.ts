import { emitEventStep } from "@medusajs/medusa/core-flows";
import {
  WorkflowResponse,
  WorkflowData,
  createHook,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";

import { UpdateRequestDTO } from "@mercurjs/framework";

import { updateRelatedProductStatusStep, updateRequestStep } from "../steps";

export const updateRequestWorkflow = createWorkflow(
  "update-request",
  function (input: WorkflowData<UpdateRequestDTO>) {
    const request = updateRequestStep(input);

    const requestUpdatedHook = createHook("requestUpdated", {
      id: input.id,
    });

    updateRelatedProductStatusStep(transform(input, (input) => input.id));
    emitEventStep({
      eventName: transform(request, (request) => {
        return `requests.${request.type}.${request.status}`;
      }),
      data: request,
    });
    return new WorkflowResponse(request, { hooks: [requestUpdatedHook] as any[] });
  }
);
