import { defineMiddlewares } from "@medusajs/medusa"
import { routeMarketplacePaymentWebhook } from "./middlewares/marketplace-payment-webhook"
import { requireCommercePaymentsEnabled } from "./middlewares/commerce-payment-policy"
import { guardFinancialWorkflow, guardNativeOrderCancel, guardNativePaymentRefund } from "./middlewares/commerce-financial-boundary"

export default defineMiddlewares({
  routes: [
    { matcher: "/hooks/payment/:provider", method: ["POST"], bodyParser: { preserveRawBody: true }, middlewares: [routeMarketplacePaymentWebhook] },
    { matcher: "/admin/payments/:id/refund", method: ["POST"], middlewares: [guardNativePaymentRefund] },
    { matcher: "/admin/orders/:id/cancel", method: ["POST"], middlewares: [guardNativeOrderCancel] },
    { matcher: "/admin/workflows-executions/:workflow_id/run", method: ["POST"], middlewares: [guardFinancialWorkflow] },
    { matcher: "/admin/workflows-executions/:workflow_id/steps/success", method: ["POST"], middlewares: [guardFinancialWorkflow] },
    { matcher: "/admin/workflows-executions/:workflow_id/steps/failure", method: ["POST"], middlewares: [guardFinancialWorkflow] },
    {
      // Medusa 2.11.3: creates provider sessions, including direct SDK calls.
      // Do not gate cart completion, webhooks, refunds, or payment reads.
      matcher: "/store/payment-collections/:id/payment-sessions",
      method: ["POST"],
      middlewares: [requireCommercePaymentsEnabled],
    },
  ],
})
