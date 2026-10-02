import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sellerOrder from "@mercurjs/b2c-core/links/seller-order"
import orderSplitPayment from "@mercurjs/b2c-core/links/order-split-order-payment"

/** Native admin authentication remains in Medusa's router; no opt-out or bypass. */
export const PROTECTED_FINANCIAL_WORKFLOWS = new Set([
  // The coordinated wrappers are only callable through their scoped routes,
  // never via arbitrary generic inputs or asynchronous completion spoofing.
  "cancel-single-order",
  'refund-seller-order-for-return',
  'proceed-return-request',
  'update-order-return-request',
  "refund-payment-workflow",
  "refund-payments-workflow",
  "refund-captured-payments-workflow",
  "refund-payment-and-recreate-payment-session",
  "cancel-order",
  "partial-payment-refund",
  "refund-split-order-payment",
  "process-payout-for-order",
])

const CONFLICT = "Deze financiële actie kan niet rechtstreeks worden uitgevoerd. Gebruik de gecoördineerde commerce-annulerings- of retourroute. Laat bij ontbrekende koppelingen eerst de bestelling en betaling controleren."
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(id)
type Row = Record<string, unknown>
type Graph = { graph(input: { entity: string; fields: string[]; filters: Record<string, string> }): Promise<{ data: Row[] }> }

function reject(res: MedusaResponse) {
  return res.status(409).json({ type: "commerce_financial_boundary", message: CONFLICT })
}
function requireId(value: unknown): string {
  if (!validId(value)) throw new Error("Unresolved identity")
  return value
}
async function rows(query: Graph, entity: string, fields: string[], filters: Record<string, string>) {
  const result = await query.graph({ entity, fields, filters })
  if (!result || !Array.isArray(result.data) || result.data.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Unresolved graph result")
  }
  return result.data
}
async function target(query: Graph, entity: string, id: string, fields: string[] = ["id"]) {
  const data = await rows(query, entity, fields, { id })
  if (data.length !== 1 || data[0].id !== id) throw new Error("Unresolved target")
  return data[0]
}
async function noSplitForCollection(query: Graph, id: string) {
  // payment_collection_id is a scalar on the actual split model. There is
  // deliberately no guessed order_id field: that association lives in a link.
  await target(query, "payment_collection", id)
  if ((await rows(query, "split_order_payment", ["id"], { payment_collection_id: id })).length) {
    throw new Error("Marketplace collection")
  }
}
async function requireNonMarketplaceOrder(query: Graph, id: string) {
  await target(query, "order", id)
  // Query raw link identities, not nullable joined seller objects: dangling
  // marketplace links must still block. Entry points come from defineLink.
  for (const [entity, fields] of [
    [sellerOrder.entryPoint, ["order_id", "seller_id"]],
    [orderSplitPayment.entryPoint, ["order_id", "split_order_payment_id"]],
  ] as const) {
    if ((await rows(query, entity, [...fields], { order_id: id })).length) throw new Error("Marketplace order")
  }
  const collections = await rows(query, "order_payment_collection", ["order_id", "payment_collection_id"], { order_id: id })
  const seen = new Set<string>()
  for (const link of collections) {
    const collectionId = requireId(link.payment_collection_id)
    if (link.order_id !== id || seen.has(collectionId)) throw new Error("Inconsistent collection links")
    seen.add(collectionId)
    await noSplitForCollection(query, collectionId)
    const owners = await rows(query, "order_payment_collection", ["order_id", "payment_collection_id"], { payment_collection_id: collectionId })
    if (owners.length !== 1 || owners[0].order_id !== id || owners[0].payment_collection_id !== collectionId) {
      throw new Error("Ambiguous collection owner")
    }
  }
}

export function guardFinancialWorkflow(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  // Workflow inputs and asynchronous step responses are caller-controlled. Never
  // classify their scope using a body flag, query parameter or bypass header.
  const id = req.params.workflow_id
  if (!validId(id) || PROTECTED_FINANCIAL_WORKFLOWS.has(id)) return reject(res)
  return next()
}

export async function guardNativeOrderCancel(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const id = requireId(req.params.id)
    await requireNonMarketplaceOrder(req.scope.resolve<Graph>(ContainerRegistrationKeys.QUERY), id)
  } catch {
    return reject(res)
  }
  return next()
}

export async function guardNativePaymentRefund(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const id = requireId(req.params.id)
    const query = req.scope.resolve<Graph>(ContainerRegistrationKeys.QUERY)
    const payment = await target(query, "payment", id, ["id", "payment_collection_id"])
    const collectionId = requireId(payment.payment_collection_id)
    await noSplitForCollection(query, collectionId)
    const owners = await rows(query, "order_payment_collection", ["order_id", "payment_collection_id"], { payment_collection_id: collectionId })
    // An unlinked payment is unknown, NOT positively nonmarketplace. The
    // installed schema provides no other authoritative nonmarketplace marker.
    if (owners.length !== 1 || owners[0].payment_collection_id !== collectionId) throw new Error("Unresolved owner")
    const orderId = requireId(owners[0].order_id)
    await requireNonMarketplaceOrder(query, orderId)
    // Check the reverse edge too; no partial/inconsistent graph can authorize.
    const reverse = await rows(query, "order_payment_collection", ["order_id", "payment_collection_id"], { order_id: orderId })
    if (!reverse.some(link => link.order_id === orderId && link.payment_collection_id === collectionId)) throw new Error("Missing reverse edge")
  } catch {
    return reject(res)
  }
  return next()
}
