import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { ContainerRegistrationKeys, createMedusaContainer, MedusaError } from '@medusajs/framework/utils'

type Owner = { container: object; cartId: string; connection: any; knex: any; active: boolean; failure: boolean; token: symbol; ownerId: string; origin?: readonly object[]; pgRegistration?: any; refundSequence?: Promise<unknown> }

// Discover the installed Awilix family symbol by structure, not its private name.
// Unknown framework layouts fail closed to the original exact-container behavior.
const familySymbol = (() => {
  try {
    const parent = createMedusaContainer(), child = createMedusaContainer({}, parent)
    const matches = Object.getOwnPropertySymbols(parent).filter(symbol => {
      const p = Object.getOwnPropertyDescriptor(parent, symbol)?.value
      const c = Object.getOwnPropertyDescriptor(child, symbol)?.value
      return Array.isArray(p) && p.length === 1 && p[0] === parent &&
        Array.isArray(c) && c.length === 2 && c[0] === child && c[1] === parent
    })
    return matches.length === 1 ? matches[0] : undefined
  } catch { return undefined }
})()

/** Own data descriptors only: copies and prototype-inherited metadata are not ancestry. */
function nativeFamily(container: object): object[] | undefined {
  if (!familySymbol) return undefined
  const tree = Object.getOwnPropertyDescriptor(container, familySymbol)?.value
  if (!Array.isArray(tree) || !tree.length || tree[0] !== container || new Set(tree).size !== tree.length) return undefined
  for (let i = 0; i < tree.length; i++) {
    const member = tree[i]
    if (!member || typeof member !== 'object') return undefined
    const suffix = Object.getOwnPropertyDescriptor(member, familySymbol)?.value
    if (!Array.isArray(suffix) || suffix.length !== tree.length - i) return undefined
    for (let j = 0; j < suffix.length; j++) {
      if (suffix[j] !== tree[i + j]) return undefined
    }
  }
  return tree
}

function ownsContainer(owner: Owner, container: object): boolean {
  if (owner.container === container) return true
  try {
    const tree = nativeFamily(container), origin = owner.origin
    if (!tree || !origin || tree.length <= origin.length) return false
    const offset = tree.length - origin.length
    if (origin.some((ancestor, i) => tree[offset + i] !== ancestor)) return false
    // Registration identity prevents child PG overrides even when the value is the same Knex.
    // Knex equality is only a consistency check AFTER native descendant provenance.
    for (const member of tree.slice(0, offset) as any[]) {
      if (!owner.pgRegistration || member.getRegistration(ContainerRegistrationKeys.PG_CONNECTION) !== owner.pgRegistration ||
          member.resolve(ContainerRegistrationKeys.PG_CONNECTION) !== owner.knex) return false
    }
    return true
  } catch { return false }
}

// Family metadata is compatibility provenance, NOT security against malicious same-process JS.
// Authority still comes only from private ALS/WeakSet state, never client-supplied input.
const scope = new AsyncLocalStorage<Owner>()
const owners = new WeakSet<Owner>()
const fail = (message: string): never => { throw new MedusaError(MedusaError.Types.CONFLICT, message) }
const valid = (id: string) => typeof id === 'string' && id.length > 0 && id.length <= 255 && id.trim() === id && !/[\u0000-\u001f\u007f]/.test(id)

/** Same namespaced key at HTTP, webhook, subscriber and operation recovery. */
export function commerceCartLockKey(cartId: string): string {
  if (!valid(cartId)) fail('Invalid commerce cart lock key')
  return createHash('sha256').update(`hobbysalon:commerce-cart:v1:${cartId}`).digest().readBigInt64BE(0).toString()
}

/** Internal capability, never supplied as workflow input or a client token. */
export function assertCommerceCartLock(container: object, cartId: string): void {
  const owner = scope.getStore()
  if (owner && owners.has(owner) && owner.failure) fail('Commerce financial lock ownership lost after payment failure; reconciliation required')
  if (!owner || !owners.has(owner) || !owner.active || owner.cartId !== cartId || !ownsContainer(owner, container) ||
      owner.connection.__knex__disposed || owner.connection._ending || owner.connection._ended) {
    fail('Commerce cart lock is not held; refusing completion effects')
  }
}

/** Irreversible invocation-local failure latch. No authority or owner escapes.
 * Native batch steps may swallow payment errors; they must not resume effects.
 * Outside a genuine owner this is a no-op. Physical unlock remains in finally.
 */
export function revokeCommerceFinancialWork(): void {
  const owner = scope.getStore()
  if (owner && owners.has(owner)) owner.failure = true
}

/** Financial authority comes solely from private ALS; recheck after awaits. */
export function assertCommerceFinancialLock(): void {
  const owner = scope.getStore()
  if (!owner) return fail('Commerce financial lock is not held')
  assertCommerceCartLock(owner.container, owner.cartId)
}

/** Public refund lifecycles queue only on the private physical-session owner.
 * A rejected predecessor never starts a sibling; failure cannot revive authority.
 * This does not acquire/release a lock or serialize unrelated cart owners.
 */
export async function withCommerceRefundSequence<T>(work: () => Promise<T>): Promise<T> {
  assertCommerceFinancialLock()
  const owner = scope.getStore()!
  const result = (owner.refundSequence ?? Promise.resolve()).then(() => {
    assertCommerceFinancialLock()
    return work()
  }).catch(error => { owner.failure = true; throw error })
  owner.refundSequence = result
  // Keep the rejected predecessor for fail-closed chaining, but observe it even
  // when native batch callers swallow their public rejection.
  void result.catch(() => {})
  return result
}

/** Native payment authority is its live database link, never a caller-supplied cart. */
export async function assertCommercePaymentLock(paymentId: string, collectionId: string): Promise<void> {
  assertCommerceFinancialLock()
  const owner = scope.getStore()!
  if (!valid(paymentId) || !valid(collectionId)) fail('Invalid commerce payment lock identity')
  const result = await commerceCartLockQuery(owner.container, owner.cartId,
    'SELECT p.id AS payment_id,p.payment_collection_id,c.cart_id FROM payment p JOIN cart_payment_collection c ON c.payment_collection_id=p.payment_collection_id WHERE p.id=? AND p.deleted_at IS NULL AND c.deleted_at IS NULL',
    [paymentId])
  assertCommerceFinancialLock()
  const rows = result?.rows
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.payment_id !== paymentId ||
      rows[0]?.payment_collection_id !== collectionId || rows[0]?.cart_id !== owner.cartId) {
    fail('Commerce payment does not belong to the locked cart and collection')
  }
}

/** Private owner-bound query for native financial adapters; no capability escapes. */
export async function commerceFinancialLockQuery(sql: string, bindings: any[] = [], expectedCartId?: string): Promise<any> {
  assertCommerceFinancialLock()
  const owner = scope.getStore()!
  if (expectedCartId !== undefined && expectedCartId !== owner.cartId) fail('Commerce financial operation belongs to a different cart')
  const result = await commerceCartLockQuery(owner.container, owner.cartId, sql, bindings)
  assertCommerceFinancialLock()
  return result
}

/** Execute tail ledger statements on the exact session that owns the lock. */
export async function commerceCartLockQuery(container: object, cartId: string, sql: string, bindings: any[] = []): Promise<any> {
  assertCommerceCartLock(container, cartId)
  const owner = scope.getStore()!
  try { return await owner.knex.raw(sql, bindings).connection(owner.connection) }
  catch { owner.active = false; fail('Commerce cart storage failed; reconciliation required') }
}

/** Root PG_CONNECTION Knex only. SESSION advisory lock, no lease/TTL and no ambient transaction.
 * Session-affine PostgreSQL is required (not transaction/statement PgBouncer pooling).
 * Busy acquisition is fail-fast/retryable. Nested same-cart native descendants reuse its private capability.
 * A dead process drops the physical session. Uncertain acquisition/unlock discards it, never loans a lock.
 */
export async function withCommerceCartLock<T>(container: any, cartId: string, work: () => Promise<T>): Promise<T> {
  const key = commerceCartLockKey(cartId)
  const inherited = scope.getStore()
  if (inherited) {
    assertCommerceCartLock(container, cartId)
    return work()
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const client = knex?.client
  if (!client || knex.isTransaction || client.transacting || typeof knex.raw !== 'function' ||
      typeof client.acquireConnection !== 'function' || typeof client.releaseConnection !== 'function' ||
      typeof client.destroyRawConnection !== 'function') fail('Commerce cart lock requires root PostgreSQL Knex')
  let origin: readonly object[] | undefined, pgRegistration: any
  try {
    const family = nativeFamily(container)
    if (family) {
      origin = Object.freeze([...family])
      pgRegistration = container.getRegistration(ContainerRegistrationKeys.PG_CONNECTION)
    }
  } catch { origin = undefined }
  let connection: any
  try { connection = await client.acquireConnection() }
  catch { return fail('Commerce cart lock unavailable; retry required') }
  const raw = (sql: string, bindings: any[] = []) => knex.raw(sql, bindings).connection(connection)
  const owner: Owner = { container, cartId, connection, knex, active: false, failure: false, token: Symbol(), ownerId: randomUUID(), origin, pgRegistration }
  let locked = false, uncertain = true, discard = false, failure: any, value!: T
  const lost = () => { owner.active = false; discard = true }
  connection.on?.('error', lost)
  connection.on?.('end', lost)
  try {
    const response = await raw('SELECT pg_try_advisory_lock(?::bigint) AS locked', [key])
    if (response?.rows?.[0]?.locked === false) { uncertain = false; fail('Commerce cart is busy; retry required') }
    if (response?.rows?.[0]?.locked !== true) fail('Commerce cart lock unavailable; retry required')
    locked = true; uncertain = false
    await raw('SET SESSION synchronous_commit = on')
    // Loss during an acquisition await is irreversible, even if its query resolves.
    if (discard || connection.__knex__disposed || connection._ending || connection._ended) fail('Commerce cart lock ownership lost during acquisition')
    owner.active = true; owners.add(owner)
    value = await scope.run(owner, work)
    assertCommerceOwner(owner)
  } catch (error) { failure = error }
  finally {
    owner.active = false; owners.delete(owner)
    discard ||= uncertain
    if (locked) {
      try { if ((await raw('SELECT pg_advisory_unlock(?::bigint) AS unlocked', [key]))?.rows?.[0]?.unlocked !== true) throw new Error() }
      catch { discard = true; failure ??= new MedusaError(MedusaError.Types.CONFLICT, 'Commerce cart unlock failed') }
    }
    connection.removeListener?.('error', lost)
    connection.removeListener?.('end', lost)
    if (!discard) {
      try { await client.releaseConnection(connection) }
      catch { discard = true; failure ??= new MedusaError(MedusaError.Types.CONFLICT, 'Commerce cart connection release failed') }
    }
    if (discard) {
      connection.__knex__disposed = true
      try { await client.destroyRawConnection(connection) } catch { /* disposed validation rejects reuse */ }
      try { await client.releaseConnection(connection) } catch { /* retain original failure */ }
    }
  }
  if (failure) throw failure
  return value
}
function assertCommerceOwner(owner: Owner) {
  if (owner.failure || !owner.active || owner.connection.__knex__disposed || owner.connection._ending || owner.connection._ended) fail('Commerce cart lock ownership lost')
}
