import {
  WorkflowResponse,
  WorkflowData,
  createHook,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk";

import { deleteReviewStep } from "../steps";

export const deleteReviewWorkflow = createWorkflow(
  {
    name: "delete-review",
  },
  function (input: WorkflowData<string>) {
    deleteReviewStep(input);

    const reviewDeletedHook = createHook("reviewDeleted", {
      review_id: input,
    });
    return new WorkflowResponse(input, {
      hooks: [reviewDeletedHook] as any[],
    });
  }
);
