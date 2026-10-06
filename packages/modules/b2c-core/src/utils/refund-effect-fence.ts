import { AsyncLocalStorage } from 'node:async_hooks'

type Invocation = { active: boolean; check: () => void }
const invocations = new AsyncLocalStorage<Invocation>()

/** Work-bound live scope/cart validation; never a caller context/token authority grant. */
export function checkRefundEffectFence(): void {
  const invocation = invocations.getStore()
  if (!invocation?.active) throw new Error('Refund effect authority unavailable')
  try { invocation.check() }
  catch (error) { invocation.active = false; throw error }
}

/** Direct admin work may have no refund scope. A present store, including an
 * inactive/revoked inherited invocation, must never degrade to cart-only work.
 * Assertion only: no token, invocation or caller context authority is returned.
 */
export function assertRefundEffectFenceIfPresent(): void {
  if (invocations.getStore() !== undefined) checkRefundEffectFence()
}

/** Bind native managers to THIS invocation, never a later caller's authority. */
export function captureRefundEffectFence(): () => void {
  checkRefundEffectFence()
  const invocation = invocations.getStore()!
  return () => {
    if (invocations.getStore() !== invocation) throw new Error('Refund effect invocation mismatch')
    checkRefundEffectFence()
  }
}

export async function withRefundEffectFence<T>(check: () => void, work: () => Promise<T>): Promise<T> {
  const parent = invocations.getStore()
  const invocation: Invocation = { active: true, check: () => {
    if (parent) {
      if (!parent.active) throw new Error('Refund effect authority unavailable')
      parent.check()
    }
    check()
  } }
  try {
    return await invocations.run(invocation, async () => {
      checkRefundEffectFence()
      const result = await work()
      checkRefundEffectFence()
      return result
    })
  } finally { invocation.active = false }
}
