import { ContainerRegistrationKeys, MathBN, OrderStatus } from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'
import { withCommerceOrderLock } from '../../../utils/commerce-financial-lock'
import { assertCommerceFinancialLock } from '../../../utils/commerce-cart-lock'
import { assertCommerceRefundQuarantineClear } from '../../../utils/commerce-refund-quarantine'
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../modules/payout'
import { refundSplitOrderPaymentWorkflow } from '../../split-order-payment/workflows/refund-split-order-payment'
import {
  executeSettlement,
  type SettlementPlan,
  type SettlementStore,
} from '../../../utils/refund-settlement'
import { createPostgresSettlementStore } from '../../../utils/refund-settlement-store'
import { withRefundEffectFence } from '../../../utils/refund-effect-fence'
import {
  createPostgresPayoutExecutionStore,
  type PayoutExecution,
} from '../../../utils/payout-execution'
import {
  allocateOrderRefund,
  nonnegativeRefundAmount,
  orderRefundScope,
  snapshotOrderRefundRequest,
  type OrderRefundRequest,
  type OrderRefundSnapshot,
} from '../../../utils/order-refund-plan'

export type SettleOrderRefundInput = OrderRefundRequest & {
  /** Cancellation already queried this snapshot for fulfillment validation. It
   * resolves scope only; balances/items are always re-read inside plan(). */
  scope_order?: OrderRefundSnapshot
}

export const orderRefundScopeFields = [
  'id', 'status', 'currency_code', 'items.id', 'fulfillments.canceled_at',
  'split_order_payment.id', 'split_order_payment.payment_collection_id',
  'payment_collections.id', 'payment_collections.captured_amount',
]
const planFields = [
  // Medusa 2.11.3 requires an ORDER-level total to calculate line totals,
  // and detail.quantity to load the purchased quantity from the order item.
  ...orderRefundScopeFields, 'total', 'items.quantity', 'items.detail.quantity', 'items.unit_price', 'items.subtotal', 'items.total',
  'split_order_payment.*', 'payouts.*', 'payouts.reversals.*',
]
function successful(value: any): void {
  if (!value || typeof value !== 'object' || value.err || value.error ||
      (value.errors !== undefined && (!Array.isArray(value.errors) || value.errors.length > 0))) {
    throw new Error('Financial effect did not succeed')
  }
}
function reversalKey(plan: Readonly<SettlementPlan>): string {
  const key = `payout-reversal:${encodeURIComponent(plan.payout_id!)}:${encodeURIComponent(plan.operation_id)}`
  if (key.length > 255) throw new Error('Payout reversal operation identity is too long')
  return key
}
/** Validate the saved provider response, not just truthiness or a local row ID. */
function reversalEvidence(row: any, payout: any, plan: Readonly<SettlementPlan>) {
  successful(row)
  const data = row.data
  successful(data)
  const transfer = typeof data.transfer === 'string' ? data.transfer : data.transfer?.id
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: plan.currency_code }).resolvedOptions().maximumFractionDigits
  if (digits === undefined) throw new Error('Invalid reversal currency precision')
  const providerAmount = MathBN.mult(plan.sellerReversal, 10 ** digits)
  if (!providerAmount.isInteger() || MathBN.gt(providerAmount, Number.MAX_SAFE_INTEGER) ||
      !payout || payout.id !== plan.payout_id || payout.currency_code?.toLowerCase() !== plan.currency_code ||
      typeof payout.data?.id !== 'string' || !payout.data.id || transfer !== payout.data.id ||
      typeof row.id !== 'string' || !row.id.trim() || row.id !== data.id ||
      row.payout_id !== plan.payout_id || row.currency_code !== plan.currency_code ||
      row.amount == null || !MathBN.eq(row.amount, plan.sellerReversal) ||
      data.idempotency_key !== reversalKey(plan) || data.currency !== plan.currency_code ||
      !Number.isSafeInteger(data.amount) || !MathBN.eq(data.amount, providerAmount)) {
    throw new Error('Saved reversal does not match fixed settlement')
  }
  return { operation_id: plan.operation_id, payout_id: plan.payout_id!, currency_code: plan.currency_code,
    amount: plan.sellerReversal, receipt_id: row.id as string }
}

/** Financial-only step: intentionally NO compensation. Once dispatched, unknown
 * outcomes remain durable reconciliation states, never compensating money calls.
 */
export const settleOrderRefundStep = createStep(
  'settle-order-refund',
  async (input: SettleOrderRefundInput, { container }) => {
    const { request, operation_id, fingerprint } = snapshotOrderRefundRequest(input)
    return withCommerceOrderLock(container, request.order_id, async () => {
    assertCommerceFinancialLock()
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    let scopeCheck: (() => void) | undefined
    const check = () => { assertCommerceFinancialLock(); scopeCheck?.() }
    const graph: typeof query.graph = async (...args) => {
      check()
      const result = await query.graph(...args)
      check()
      return result
    }
    const readOrder = async (fields: string[]) => {
      const { data } = await graph({ entity: 'orders', fields, filters: { id: request.order_id } })
      if (data.length !== 1 || data[0].id !== request.order_id) throw new Error('Refund order not found')
      return data[0] as unknown as OrderRefundSnapshot
    }
    const initial = await readOrder(orderRefundScopeFields)
    if (initial.id !== request.order_id) throw new Error('Refund order identity mismatch')
    const settlementInput = { operation_id, order_id: request.order_id, scope_id: orderRefundScope(initial), fingerprint }
    // Before planning OR replay, an earlier uncertain native dispatch blocks the
    // entire cancellation workflow, including already-canceled inventory retries.
    await assertCommerceRefundQuarantineClear(settlementInput.scope_id)
    check()
    const postgres = createPostgresSettlementStore(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), assertCommerceFinancialLock)
    let recordedPayout: PayoutExecution | null = null
    const verifyRecordedPayout = async (order: OrderRefundSnapshot) => {
      if (!recordedPayout) return
      const saved = recordedPayout, expected = saved.plan
      if (orderRefundScope(order) !== saved.scope_id || order.id !== saved.order_id) throw new Error('Recorded payout scope changed')
      const { data: links } = await graph({ entity: 'order_payout', fields: ['order_id', 'payout_id'], filters: { order_id: request.order_id } })
      const projected = order.payouts ?? []
      if (expected.amount === 0) {
        if (saved.payout_id || saved.transfer_id || links.length || projected.length) throw new Error('Recorded zero payout contradicts live evidence')
        return
      }
      if (!saved.payout_id || !saved.transfer_id || links.length !== 1 || links[0].order_id !== request.order_id ||
          links[0].payout_id !== saved.payout_id || projected.length !== 1 || projected[0].id !== saved.payout_id ||
          !MathBN.eq(projected[0].amount, expected.amount)) throw new Error('Recorded payout linkage requires reconciliation')
      const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
      const payout = await service.retrievePayout(saved.payout_id)
      check()
      const data = payout.data as Record<string, any> | null
      const digits = new Intl.NumberFormat('en', { style: 'currency', currency: expected.currency }).resolvedOptions().maximumFractionDigits
      if (digits === undefined) throw new Error('Invalid payout currency precision')
      const providerAmount = MathBN.mult(expected.amount, 10 ** digits)
      const ref = (value: any) => typeof value === 'string' ? value : value?.id
      if (payout.deleted_at || payout.id !== saved.payout_id || payout.payout_account_id !== expected.account_id ||
          payout.currency_code?.toLowerCase() !== expected.currency || !MathBN.eq(payout.amount, expected.amount) ||
          !providerAmount.isInteger() || !data || data.id !== saved.transfer_id || data.currency !== expected.currency ||
          !Number.isSafeInteger(data.amount) || !MathBN.eq(data.amount, providerAmount) ||
          ref(data.destination) !== expected.account_reference_id || ref(data.source_transaction) !== expected.source_transaction) {
        throw new Error('Recorded payout receipt requires reconciliation')
      }
    }
    // Canceled retries are permitted ONLY for the matching completed operation.
    // Check under the same lock as executeSettlement; never use a stale preflight
    // lookup to authorize a pending money leg on an already-canceled order.
    const store: SettlementStore = {
      withScopeLock: (scope, work) => postgres.withScopeLock(scope, async (session) => {
        if (!session.assertActive) throw new Error('Missing refund scope authority')
        scopeCheck = session.assertActive
        check()
        // Runs for retries as well as fresh plans, under the collection lock.
        const payoutExecutions = createPostgresPayoutExecutionStore(container.resolve(ContainerRegistrationKeys.PG_CONNECTION))
        await payoutExecutions.assertScopeResolved(scope)
        check()
        const payoutExecution = await payoutExecutions.get(request.order_id)
        check()
        if (payoutExecution && (payoutExecution.phase !== 'completed' || payoutExecution.scope_id !== scope)) {
          throw new Error('Unresolved or changed-scope payout requires reconciliation')
        }
        recordedPayout = payoutExecution
        if (recordedPayout) await verifyRecordedPayout(await readOrder(planFields))
        check()
        if (request.kind === 'cancel' && initial.status === OrderStatus.CANCELED) {
          const existing = await session.getOperation(operation_id)
          check()
          if (existing?.phase !== 'completed') throw new Error('Canceled order requires a completed settlement')
        }
        check()
        return withRefundEffectFence(check, () => work(session))
      }),
    }
    const result = await executeSettlement(store, settlementInput, {
      assertActive: check,
      plan: async () => {
        check()
        const order = await readOrder(planFields)
        if (orderRefundScope(order) !== settlementInput.scope_id) throw new Error('Refund payment scope changed')
        // Revalidate the exact snapshot used for allocation as well, so a later
        // missing projection cannot silently turn a known transfer into zero.
        await verifyRecordedPayout(order)
        check()
        if (request.kind === 'cancel' && (order.status === OrderStatus.CANCELED ||
            (order.fulfillments ?? []).some((fulfillment) => !fulfillment.canceled_at))) {
          throw new Error('Order cannot be canceled')
        }
        const { data: commissionLines } = await graph({ entity: 'commission_line',
          fields: ['item_line_id', 'value'], filters: { item_line_id: (order.items ?? []).map((item) => item.id) } })
        const plan = allocateOrderRefund(order, request, settlementInput, commissionLines)
        // Validate provider-key length before persisting or refunding anything.
        if (plan.sellerReversal > 0) reversalKey({ ...plan, payment_id: null })
        let payment_id: string | null = null
        if (plan.customerRefund > 0) {
          if (!plan.split_order_payment_id) throw new Error('Positive refund requires a split payment')
          const { data: collections } = await graph({ entity: 'payment_collection',
            fields: ['id', 'currency_code', 'payments.id'], filters: { id: settlementInput.scope_id } })
          const collection = collections[0]
          if (collections.length !== 1 || collection.id !== settlementInput.scope_id ||
              collection.currency_code?.toLowerCase() !== plan.currency_code) throw new Error('Invalid refund collection')
          const ids = (collection.payments ?? []).map((payment) => payment.id)
          if (!ids.length || ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
            throw new Error('Invalid collection payment identities')
          }
          const { data: payments } = await graph({ entity: 'payment', fields: [
            'id', 'currency_code', 'canceled_at', 'captures.amount', 'refunds.amount',
          ], filters: { id: ids } })
          if (payments.length !== ids.length || new Set(payments.map((payment) => payment.id)).size !== ids.length ||
              payments.some((payment) => !ids.includes(payment.id))) throw new Error('Incomplete collection payments')
          const eligible = payments.map((payment) => {
            if (payment.currency_code?.toLowerCase() !== plan.currency_code) throw new Error('Payment currency mismatch')
            const sum = (rows: { amount: Parameters<typeof MathBN.convert>[0] }[]) => rows.reduce(
              (total, row) => MathBN.add(total, nonnegativeRefundAmount(row.amount)), MathBN.convert(0))
            const remaining = MathBN.sub(sum(payment.captures ?? []), sum(payment.refunds ?? []))
            if (MathBN.lt(remaining, 0)) throw new Error('Invalid native refundable amount')
            return { payment, remaining }
          }).filter(({ payment, remaining }) => !payment.canceled_at && MathBN.gt(remaining, 0))
          if (eligible.length !== 1 || MathBN.gt(plan.customerRefund, eligible[0].remaining)) {
            throw new Error('No sole eligible payment for refund')
          }
          payment_id = eligible[0].payment.id
        }
        return { ...plan, payment_id }
      },
      refund: async (plan) => {
        check()
        if (!plan.split_order_payment_id || !plan.payment_id) throw new Error('Missing pinned refund identities')
        const response = await refundSplitOrderPaymentWorkflow(container).run({ input: {
          id: plan.split_order_payment_id, amount: plan.customerRefund,
          operation_id: plan.operation_id, payment_id: plan.payment_id,
        }, throwOnError: true })
        check()
        successful(response)
        // Outer workflow returns updated split records; its nested native refund
        // workflow validates the successful PaymentDTO and transaction dependency.
        if (!Array.isArray(response.result) || response.result.length !== 1 || response.result[0]?.id !== plan.split_order_payment_id) {
          throw new Error('Refund workflow returned no matching successful result')
        }
        successful(response.result[0])
        return response.result
      },
      reverse: async (plan) => {
        check()
        const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
        const payout = await service.retrievePayout(plan.payout_id!)
        check()
        const row = await withRefundEffectFence(check, () => service.createPayoutReversal({ payout_id: plan.payout_id!, amount: plan.sellerReversal,
          currency_code: plan.currency_code, operation_id: plan.operation_id }))
        check()
        return reversalEvidence(row, payout, plan)
      },
      recoverReversal: async (plan) => {
        check()
        const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
        const payout = await service.retrievePayout(plan.payout_id!)
        check()
        const key = reversalKey(plan)
        let found: ReturnType<typeof reversalEvidence> | null = null
        // Read-only LOCAL rows. Missing proof means unknown outcome, never
        // permission to ask the provider to create/recover another reversal.
        for (let skip = 0; ; skip += 100) {
          const rows = await service.listPayoutReversals({ payout_id: plan.payout_id! },
            { take: 100, skip, order: { id: 'ASC' } })
          check()
          for (const row of rows) {
            if (row.data?.idempotency_key !== key) continue
            if (found) throw new Error('Ambiguous saved reversal evidence')
            found = { ...reversalEvidence(row, payout, plan) }
          }
          if (rows.length < 100) break
        }
        return found
      },
    })
    assertCommerceFinancialLock()
    if (result.receipt.phase !== 'completed') throw new Error('Financial settlement is incomplete')
    return new StepResponse(result)
    })
  }
)
