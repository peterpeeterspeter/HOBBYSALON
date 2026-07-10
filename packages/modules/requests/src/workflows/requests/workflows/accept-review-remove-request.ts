import {
  WorkflowResponse,
  WorkflowData,
  createWorkflow,
  transform,
} from "@medusajs/workflows-sdk";

import {
  AcceptRequestDTO,
  RemoveReviewRequestUpdatedEvent,
} from "@mercurjs/framework";

import { updateRequestWorkflow } from "./update-request";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { parseReviewRemoveRequestData } from "../utils/request-data-schemas";

export const acceptReviewRemoveRequestWorkflow = createWorkflow(
  "accept-review-remove-request",
  function (input: WorkflowData<AcceptRequestDTO>) {
    const requestData = transform({ input }, ({ input }) =>
      parseReviewRemoveRequestData(input.data)
    );

    emitEventStep({
      eventName: RemoveReviewRequestUpdatedEvent.REMOVED,
      data: {
        id: requestData.review_id,
      },
    });
    updateRequestWorkflow.runAsStep({ input });
    return new WorkflowResponse(true);
  }
);
