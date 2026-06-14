import {
  WorkflowResponse,
  WorkflowData,
  createHook,
  createWorkflow,
} from "@medusajs/workflows-sdk";

import { deleteCommissionRuleStep } from "../steps";

export const deleteCommissionRuleWorkflow = createWorkflow(
  "delete-commission-rule",
  function (input: WorkflowData<string>) {
    deleteCommissionRuleStep(input);

    const commissionRuleDeletedHook = createHook("commissionRuleDeleted", {
      commission_rule_id: input,
    });
    return new WorkflowResponse(input, {
      hooks: [commissionRuleDeletedHook] as any[],
    });
  }
);
