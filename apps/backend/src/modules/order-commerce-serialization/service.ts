import NativeOrderModule from '@medusajs/order'
import type { Context, OrderTypes } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'
import { assertCommerceFinancialLock } from '@mercurjs/b2c-core/utils/commerce-cart-lock'
import { commerceNativeFence } from '@mercurjs/b2c-core/utils/commerce-native-fence'
import { assertCommerceOrderLock, assertCommerceOrderCancellation } from '@mercurjs/b2c-core/utils/commerce-financial-lock'

type NativeCancel = (ids: string | string[], sharedContext?: Context) => Promise<OrderTypes.OrderDTO[]>

/** Copy before the first await: callers cannot swap a validated batch mid-flight. */
function cancellationIds(ids: string | string[]): string[] {
  assertCommerceFinancialLock()
  const batch = typeof ids === 'string' ? [ids] : Array.isArray(ids) ? Array.from(ids) : []
  if (!batch.length || batch.some(id => typeof id !== 'string' || !id.length || id.length > 255 ||
      id.trim() !== id || /[\u0000-\u001f\u007f]/.test(id)) || new Set(batch).size !== batch.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Order cancellation requires distinct valid order identities')
  }
  return batch
}

async function assertCancellationBatch(ids: string[]): Promise<void> {
  for (const id of ids) {
    await assertCommerceOrderLock(id)
    assertCommerceFinancialLock()
    // Authoritative, session-affine SELECT in the shared private lock helper:
    // refund_settlement.operation_id = `cancel:${id}`, order_id = id,
    // phase = completed, scope = the native order/payment_collection scope.
    // Native cancelPayment can swallow provider failures; its return is not proof.
    await assertCommerceOrderCancellation(id)
    assertCommerceFinancialLock()
  }
}

/** Keep native transaction, status mutation, serialization and event semantics.
 * Only cancellation is gated; no caller-provided cart/context grants authority.
 */
export default class OrderCommerceSerializationService extends NativeOrderModule.service {
  constructor(...args: ConstructorParameters<typeof NativeOrderModule.service>) {
    super(...args)
    // Medusa 2.11.3 declares cancel_ private, but emits a callable JS method.
    // An own, immutable wrapper closes direct runtime calls without overriding
    // that private TS member or broadening unrelated order operations.
    const nativeCancel = (this as unknown as { cancel_: NativeCancel }).cancel_
    Object.defineProperty(this, 'cancel_', {
      configurable: false,
      writable: false,
      value: async (ids: string | string[], sharedContext?: Context) => {
        assertCommerceFinancialLock()
        const batch = cancellationIds(ids)
        await assertCancellationBatch(batch)
        assertCommerceFinancialLock()
        // Native cancel_ awaits transaction acquisition and listOrders_ before
        // updating status. Guard just this invocation, not shared services, so
        // lock loss at those awaits cannot flow into an unguarded status write.
        // Only the native MODULE is scoped through Object.create: its internal
        // service, repositories and managers always keep their real receivers.
        const guarded = Object.create(this)
        guarded.baseRepository_ = commerceNativeFence(this.baseRepository_, assertCommerceFinancialLock)
        guarded.orderService_ = commerceNativeFence(this.orderService_, assertCommerceFinancialLock)
        guarded.listOrders_ = async (...listArgs: Parameters<typeof this.listOrders_>) => {
          assertCommerceFinancialLock()
          const orders = await Reflect.apply(this.listOrders_, guarded, listArgs)
          assertCommerceFinancialLock()
          return orders
        }
        const result = await nativeCancel.call(guarded, batch, sharedContext)
        assertCommerceFinancialLock()
        return result
      }
    })
  }

  async cancel(ids: string, sharedContext?: Context): Promise<OrderTypes.OrderDTO>
  async cancel(ids: string[], sharedContext?: Context): Promise<OrderTypes.OrderDTO[]>
  async cancel(ids: string | string[], sharedContext?: Context): Promise<OrderTypes.OrderDTO | OrderTypes.OrderDTO[]>
  async cancel(ids: string | string[], sharedContext?: Context): Promise<OrderTypes.OrderDTO | OrderTypes.OrderDTO[]> {
    // Deliberately undecorated: refusal precedes even native manager acquisition.
    assertCommerceFinancialLock()
    const batch = cancellationIds(ids)
    await assertCancellationBatch(batch)
    assertCommerceFinancialLock()
    const result = Array.isArray(ids)
      ? await super.cancel(batch, sharedContext)
      : await super.cancel(batch[0], sharedContext)
    assertCommerceFinancialLock()
    return result
  }
}
