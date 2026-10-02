import { ContainerRegistrationKeys, Modules, MathBN, ReturnStatus, OrderChangeStatus, OrderChangeType, ChangeActionType } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { beginReturnOrderWorkflow, requestItemReturnWorkflow, confirmReturnRequestWorkflow } from '@medusajs/medusa/core-flows'
import {
  executeNativeReturn,
  fingerprintNativeReturnPlan,
  validNativeReturnId,
  type NativeReturnPlan,
  type NativeReturnIdentity,
} from '../../../utils/native-return-lifecycle'
import { createPostgresNativeReturnStore } from '../../../utils/native-return-store'

function requireEvidence(ok: unknown): asserts ok {
  if (!ok) throw new Error('Native return evidence mismatch')
}
function successful(run: any): any {
  requireEvidence(run && Array.isArray(run.errors) && !run.errors.length && !run.thrownError &&
    run.transaction?.getState() === 'done' && run.result)
  return run.result
}
function preview(result: any, plan: NativeReturnPlan, identity: NativeReturnIdentity) {
  requireEvidence(result?.id === plan.order_id && result.order_change?.id === identity.order_change_id &&
    result.order_change.order_id === plan.order_id && result.order_change.return_id === identity.return_id)
}
function exactItems(rows: any[], plan: NativeReturnPlan, identity: NativeReturnIdentity, actions: boolean) {
  requireEvidence(Array.isArray(rows) && rows.length === plan.items.length)
  const seen = new Set<string>()
  for (const row of rows) {
    const details = actions ? row.details : row
    const id = actions ? details?.reference_id : row.item_id
    const expected = plan.items.find(item => item.id === id)
    requireEvidence(expected && !seen.has(id) && details?.quantity != null &&
      MathBN.eq(details.quantity, expected.quantity) && (details.reason_id ?? null) === expected.reason_id &&
      row.return_id === identity.return_id)
    seen.add(id)
    if (actions) requireEvidence(row.action === ChangeActionType.RETURN_ITEM &&
      row.order_change_id === identity.order_change_id && row.order_id === plan.order_id &&
      row.reference === 'return' && row.reference_id === identity.return_id)
  }
}

/** Intentionally no compensator: nested workflows are standalone runs, never
 * runAsStep. Outer refund/status failure must not undo persisted native identity.
 * Service aliases/fields below are the Medusa 2.11.3 order module contracts. */
export const prepareNativeReturnStep = createStep(
  { name: 'prepare-native-return', noCompensation: true },
  async (input: NativeReturnPlan, { container }) => {
    const store = createPostgresNativeReturnStore(container.resolve(ContainerRegistrationKeys.PG_CONNECTION))
    const orderService = container.resolve(Modules.ORDER)
    const prepared = await executeNativeReturn(store, input, {
      async begin(plan, fingerprint) {
        const result = successful(await beginReturnOrderWorkflow(container).run({
          input: { order_id: plan.order_id, location_id: plan.location_id ?? undefined,
            metadata: { hobbysalon_return_request_id: plan.request_id, hobbysalon_return_fingerprint: fingerprint } },
          throwOnError: true,
        }))
        requireEvidence(result.order_id === plan.order_id && validNativeReturnId(result.id) && validNativeReturnId(result.return_id))
        return { return_id: result.return_id, order_change_id: result.id }
      },
      async items(plan, identity) {
        const result = successful(await requestItemReturnWorkflow(container).run({
          input: { return_id: identity.return_id, items: plan.items.map(item => ({
            id: item.id, quantity: item.quantity, reason_id: item.reason_id ?? undefined,
          })) }, throwOnError: true,
        }))
        preview(result, plan, identity)
      },
      async confirm(plan, identity) {
        const result = successful(await confirmReturnRequestWorkflow(container).run({
          input: { return_id: identity.return_id }, throwOnError: true,
        }))
        // Native confirm returns a PRE-confirmation preview. Verify persisted state below.
        preview(result, plan, identity)
      },
      async verify(plan, identity, phase) {
        const ret = await orderService.retrieveReturn(identity.return_id, { relations: ['items'] })
        const change = await orderService.retrieveOrderChange(identity.order_change_id, { relations: ['actions'] })
        // Published ReturnDTO / OrderChangeDTO unions are narrower than the 2.11.3
        // order-module enums (open, return_request). Compare the stored strings.
        const returnStatus = String(ret?.status)
        const changeType = String(change?.change_type)
        const changeStatus = String(change?.status)
        requireEvidence(ret?.id === identity.return_id && ret.order_id === plan.order_id &&
          (ret.location_id ?? null) === plan.location_id && !ret.canceled_at &&
          ret.metadata?.hobbysalon_return_request_id === plan.request_id &&
          ret.metadata?.hobbysalon_return_fingerprint === fingerprintNativeReturnPlan(plan) &&
          change?.id === identity.order_change_id && change.order_id === plan.order_id &&
          change.return_id === identity.return_id && changeType === OrderChangeType.RETURN_REQUEST && !change.canceled_at)
        if (phase === 'confirmed') {
          // Receipt advances the same return without changing its original request
          // quantities/actions; the exact original identity and plan proofs still apply.
          requireEvidence(
            (returnStatus === ReturnStatus.REQUESTED ||
              returnStatus === ReturnStatus.PARTIALLY_RECEIVED ||
              returnStatus === ReturnStatus.RECEIVED) &&
            changeStatus === OrderChangeStatus.CONFIRMED)
          exactItems(ret.items, plan, identity, false)
        } else {
          requireEvidence(returnStatus === ReturnStatus.OPEN && changeStatus === OrderChangeStatus.PENDING &&
            Array.isArray(ret.items) && ret.items.length === 0)
        }
        if (phase === 'begun') requireEvidence(Array.isArray(change.actions) && change.actions.length === 0)
        else exactItems(change.actions, plan, identity, true)
      },
    })
    return new StepResponse(prepared)
  }
)
