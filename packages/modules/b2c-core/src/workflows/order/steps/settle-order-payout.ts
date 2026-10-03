import { ContainerRegistrationKeys, MathBN, Modules } from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'
import { PayoutAccountStatus, PayoutWorkflowEvents } from '@mercurjs/framework'
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../modules/payout'
import orderPayoutLink from '../../../links/order-payout'
import { resolveSellerPayoutAccountRelation } from '../../../shared/utils/resolve-seller-payout-account'
import { createPostgresSettlementStore } from '../../../utils/refund-settlement-store'
import {
  createPostgresPayoutExecutionStore,
  executePayout,
  withPayoutDispatchPlan,
  type PayoutExecution,
  type PayoutPlan,
} from '../../../utils/payout-execution'
import { refundMoney, remainingSellerEntitlement } from '../../../utils/refund-money'
import { assertSellerPayoutsReleased } from '../../../utils/payout-release-gate'

function scalar(value: any): number {
  if (value == null) throw new Error('Missing payout amount')
  const decimal = MathBN.convert(value)
  if (!decimal.isFinite() || decimal.isNegative()) throw new Error('Invalid payout amount')
  const amount = Number(decimal.toString())
  if (!Number.isFinite(amount) || !MathBN.eq(amount, decimal)) throw new Error('Unsafe payout amount')
  return amount
}
function minor(value: any, currency: string): bigint {
  const amount = scalar(value), money = refundMoney(currency), units = money.toMinor(amount)
  if (!MathBN.eq(money.fromMinor(units), value)) throw new Error('Payout amount is not currency-exact')
  return units
}
function receipt(payout: any, plan: PayoutPlan, expectedId?: string | null) {
  const data = payout?.data
  const destination = typeof data?.destination === 'string' ? data.destination : data?.destination?.id
  const source = typeof data?.source_transaction === 'string' ? data.source_transaction : data?.source_transaction?.id
  if (!payout?.id || (expectedId && payout.id !== expectedId) || payout.payout_account_id !== plan.account_id ||
      payout.currency_code !== plan.currency || !MathBN.eq(payout.amount, plan.amount) ||
      typeof data?.id !== 'string' || !data.id.trim() || !Number.isSafeInteger(data.amount) ||
      BigInt(data.amount) !== minor(plan.amount, plan.currency) || data.currency !== plan.currency ||
      destination !== plan.account_reference_id || source !== plan.source_transaction ||
      data.metadata?.transaction_id !== plan.transaction_id) throw new Error('Payout receipt does not match frozen plan')
  return { payout_id: payout.id as string, transfer_id: data.id as string }
}

/** One coordinated, non-compensating step. No inner money workflow registration. */
export const settleOrderPayoutStep = createStep('settle-order-payout', async (input: { order_id: string }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service = container.resolve<PayoutModuleService>(PAYOUT_MODULE)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const events = container.resolve(Modules.EVENT_BUS)
  await assertSellerPayoutsReleased(knex)
  const readOrder = async () => {
    const { data } = await query.graph({ entity: 'order', fields: [
      'id', 'status', 'currency_code', 'seller.id', 'items.id', 'split_order_payment.*', 'payment_collections.id',
    ], filters: { id: input.order_id } })
    if (data.length !== 1 || data[0].id !== input.order_id) throw new Error('Payout order not found')
    return data[0]
  }
  const links = async () => (await query.graph({ entity: orderPayoutLink.entryPoint,
    fields: ['order_id', 'payout_id'], filters: { order_id: input.order_id } })).data
  try {
    const initial = await readOrder()
    const scope_id = initial.split_order_payment?.payment_collection_id
    const execution = await executePayout(createPostgresSettlementStore(knex), createPostgresPayoutExecutionStore(knex),
      { order_id: input.order_id, scope_id }, {
        plan: async () => {
          const order = await readOrder(), split = order.split_order_payment
          const currency = order.currency_code?.toLowerCase()
          if (!split || Array.isArray(split) || !split.id || split.payment_collection_id !== scope_id ||
              order.status === 'canceled' || !order.seller?.id || !/^[a-z]{3}$/.test(currency) ||
              split.currency_code?.toLowerCase() !== currency || order.payment_collections?.length !== 1 ||
              order.payment_collections[0].id !== scope_id || (await links()).length) throw new Error('Invalid payout order scope')
          const { data: collections } = await query.graph({ entity: 'payment_collection',
            fields: ['id', 'currency_code', 'payments.id'], filters: { id: scope_id } })
          if (collections.length !== 1 || collections[0].id !== scope_id ||
              collections[0].currency_code?.toLowerCase() !== currency || collections[0].payments?.length !== 1) throw new Error('Ambiguous payout payment')
          const paymentId = collections[0].payments[0].id
          const { data: payments } = await query.graph({ entity: 'payment', fields: [
            'id', 'currency_code', 'canceled_at', 'data', 'captures.amount', 'refunds.amount',
          ], filters: { id: paymentId } })
          const payment = payments[0]
          if (payments.length !== 1 || payment.id !== paymentId || payment.canceled_at ||
              payment.currency_code?.toLowerCase() !== currency || payment.captures?.length !== 1) throw new Error('Invalid captured payout payment')
          const captured = minor(split.captured_amount, currency), refunded = minor(split.refunded_amount, currency)
          const nativeCaptured = minor(payment.captures[0].amount, currency)
          const nativeRefunded = (payment.refunds ?? []).reduce((sum, row) => sum + minor(row.amount, currency), 0n)
          // A marketplace collection may fund several seller orders. Reconcile
          // ALL allocations to the native payment, then calculate this seller's
          // entitlement only; comparing one split to the entire charge is wrong.
          const { data: allocations } = await query.graph({ entity: 'split_order_payment', fields: [
            'id', 'payment_collection_id', 'currency_code', 'captured_amount', 'refunded_amount',
          ], filters: { payment_collection_id: scope_id } })
          if (!allocations.length || new Set(allocations.map(row => row.id)).size !== allocations.length) throw new Error('Invalid payout allocations')
          let totalCaptured = 0n, totalRefunded = 0n, foundTarget = false
          for (const allocation of allocations) {
            if (!allocation.id || allocation.payment_collection_id !== scope_id || allocation.currency_code?.toLowerCase() !== currency) throw new Error('Invalid payout allocation scope')
            const allocationCaptured = minor(allocation.captured_amount, currency), allocationRefunded = minor(allocation.refunded_amount, currency)
            if (allocationRefunded > allocationCaptured) throw new Error('Invalid payout allocation balance')
            totalCaptured += allocationCaptured; totalRefunded += allocationRefunded
            if (allocation.id === split.id) {
              if (allocationCaptured !== captured || allocationRefunded !== refunded) throw new Error('Payout split snapshot changed')
              foundTarget = true
            }
          }
          if (!foundTarget || captured <= 0n || refunded > captured || totalCaptured !== nativeCaptured || totalRefunded !== nativeRefunded) throw new Error('Payout balances do not match payment')
          const source = payment.data?.latest_charge
          const source_transaction = typeof source === 'string' ? source : source?.id
          if (typeof source_transaction !== 'string' || !source_transaction.startsWith('ch_')) throw new Error('Missing captured source charge')
          const ids = (order.items ?? []).map(item => item.id)
          if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Invalid payout items')
          const { data: commission } = await query.graph({ entity: 'commission_line', fields: ['item_line_id', 'value'], filters: { item_line_id: ids } })
          if (ids.some(id => !commission.some(line => line.item_line_id === id)) || commission.some(line => !ids.includes(line.item_line_id))) throw new Error('Commission not ready')
          // Commission lines may have sub-minor precision. Aggregate in real
          // MathBN, then apply the existing cumulative refund rounding policy.
          let commissionTotal = MathBN.convert(0)
          for (const line of commission) { scalar(line.value); commissionTotal = MathBN.add(commissionTotal, line.value) }
          const money = refundMoney(currency), fee = money.toMinor(scalar(commissionTotal))
          if (fee > captured) throw new Error('Commission exceeds capture')
          const relation = await resolveSellerPayoutAccountRelation(query, order.seller.id)
          const account = relation?.payout_account
          if (!account || relation?.payout_account_id !== account.id || account.status !== PayoutAccountStatus.ACTIVE ||
              !account.reference_id?.startsWith('acct_')) throw new Error('Active seller payout account required')
          const amount = money.fromMinor(remainingSellerEntitlement(captured, fee, refunded))
          minor(amount, currency)
          return { amount, currency, account_id: account.id, account_reference_id: account.reference_id,
            source_transaction, transaction_id: input.order_id }
        },
        transfer: async plan => {
          // The module reloads the account too; verify again immediately before
          // dispatch, and validate its returned actual destination against plan.
          const account = await service.retrievePayoutAccount(plan.account_id)
          if (account.reference_id !== plan.account_reference_id || account.status !== PayoutAccountStatus.ACTIVE) throw new Error('Payout account changed')
          const payout = await withPayoutDispatchPlan(plan, () => service.createPayout({ amount: plan.amount, currency_code: plan.currency,
            account_id: plan.account_id, transaction_id: plan.transaction_id, source_transaction: plan.source_transaction }))
          return receipt(payout, plan)
        },
        link: async payoutId => {
          await container.resolve(ContainerRegistrationKeys.LINK).create([{
            [Modules.ORDER]: { order_id: input.order_id }, [PAYOUT_MODULE]: { payout_id: payoutId },
          }])
        },
        verify: async (row: PayoutExecution) => {
          if (row.plan.transaction_id !== input.order_id) throw new Error('Payout receipt order mismatch')
          const actual = await links()
          if (row.plan.amount === 0) {
            if (actual.length || row.payout_id || row.transfer_id) throw new Error('Invalid zero payout evidence')
          } else {
            if (actual.length !== 1 || actual[0].order_id !== input.order_id || actual[0].payout_id !== row.payout_id) throw new Error('Payout link mismatch')
            const proof = receipt(await service.retrievePayout(row.payout_id!), row.plan, row.payout_id)
            if (proof.transfer_id !== row.transfer_id) throw new Error('Payout transfer mismatch')
          }
        },
      })
    if (execution.phase !== 'completed') throw new Error('Payout incomplete')
    // No fictitious payout ID/event for zero entitlement.
    if (execution.payout_id) await events.emit({ name: PayoutWorkflowEvents.SUCCEEDED,
      data: { id: execution.payout_id, order_id: input.order_id } })
    return new StepResponse(execution)
  } catch (error) {
    await events.emit({ name: PayoutWorkflowEvents.FAILED,
      data: { order_id: input.order_id, error_message: 'Payout settlement failed; reconciliation may be required' } })
    throw error
  }
})
