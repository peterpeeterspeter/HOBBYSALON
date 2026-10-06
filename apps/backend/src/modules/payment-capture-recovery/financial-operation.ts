import { AsyncLocalStorage } from 'node:async_hooks'
import { isDeepStrictEqual } from 'node:util'
import { BigNumber, MedusaError } from '@medusajs/framework/utils'
import { assertCommerceFinancialLock as assertCommerceCartFinancialLock } from '@mercurjs/b2c-core/utils/commerce-cart-lock'
import { assertRefundEffectFenceIfPresent } from '@mercurjs/b2c-core/utils/refund-effect-fence'

function assertCommerceFinancialLock(): void {
  assertCommerceCartFinancialLock()
  assertRefundEffectFenceIfPresent()
}

type Kind = 'refundPayment' | 'cancelPayment' | 'deleteSession'
type Input = { data?: Record<string, unknown> | null; amount?: unknown; context?: { idempotency_key?: unknown } }
type Identity = { kind: Kind; nativeId: string; providerId: string; data: Input['data']; idempotencyKey?: unknown; amount?: unknown }
type Binding = Readonly<{ kind: Kind; nativeId: string; providerId: string; providerDataId: string; data: Input['data']; idempotencyKey?: string; amount?: string }>
// Neither the store nor a live capability is exported or put on a service or
// caller context. Every invocation owns its revocable, single-dispatch scope.
const operations = new AsyncLocalStorage<{ binding: Binding; active: boolean; consumed: boolean }>()
const reject = (): never => { throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Commerce financial operation binding identity mismatch or missing') }
const identity = (value: unknown): string => typeof value === 'string' && value.length > 0 && value.trim() === value ? value : reject()
const amountIdentity = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  const amount = new BigNumber(value as ConstructorParameters<typeof BigNumber>[0]).bigNumber
  if (!amount || !amount.isFinite()) return reject()
  return amount.toString()
}

/** Called only by module entries after fresh native reads and ownership checks.
 * Copy primitive identities before any later await; never retain caller-owned
 * identity/amount objects as authority. The native provider input is unchanged.
 */
export async function withFinancialOperation<T>(value: Identity, fn: () => Promise<T>): Promise<T> {
  assertCommerceFinancialLock()
  const binding: Binding = Object.freeze({
    kind: value.kind, nativeId: identity(value.nativeId), providerId: identity(value.providerId),
    providerDataId: identity(value.data?.id), data: Object.freeze(structuredClone(value.data!)),
    idempotencyKey: value.idempotencyKey === undefined ? undefined : identity(value.idempotencyKey),
    amount: amountIdentity(value.amount)
  })
  const scope = { binding, active: true, consumed: false }
  try {
    return await operations.run(scope, async () => {
      const result = await fn()
      assertCommerceFinancialLock()
      return result
    })
  } finally { scope.active = false }
}

export function assertFinancialOperation(kind: Kind, providerId: string, input: Input): void {
  assertCommerceFinancialLock()
  const scope = operations.getStore()
  if (!scope?.active || scope.consumed) return reject()
  const binding = scope.binding
  if (binding.kind !== kind || binding.providerId !== providerId ||
      binding.providerDataId !== input?.data?.id || !isDeepStrictEqual(binding.data, input.data) ||
      binding.idempotencyKey !== input.context?.idempotency_key || binding.amount !== amountIdentity(input.amount)) reject()
  scope.consumed = true
}
