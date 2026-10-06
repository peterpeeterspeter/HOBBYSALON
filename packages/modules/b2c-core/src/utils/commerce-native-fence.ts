type NativeObject = Record<PropertyKey, any>
type NativeCallable = (...args: any[]) => any

const writes = new Set(['create', 'update', 'delete', 'softDelete', 'restore', 'upsert', 'upsertWithReplace'])
const repositoryContext: Record<string, number> = {
  find: 1, findAndCount: 1, create: 1, update: 1, delete: 1,
  softDelete: 1, restore: 1, upsert: 1, upsertWithReplace: 2,
}
const resources = new Set([
  'getFreshManager', 'getActiveManager', 'fork', 'getContext', 'getDriver',
  'getConnection', 'getKnex', 'getTransactionContext', 'getEventManager',
  'createQueryBuilder', 'qb', 'queryBuilder', 'getKnexQuery', 'raw', 'clone',
])
// Cleanup must remain possible after capability revocation.
const cleanup = new Set(['rollback', 'rollbackTransaction'])

/**
 * Invocation-local capability fence, not a lock or an authority grant.
 *
 * Medusa 2.11.3 internal services have a private event-subscriber WeakMap, and
 * their repositories themselves bind methods to the real repository. Neither
 * Object.create(service) nor a proxy receiver can safely intercept internal
 * calls. Instead, keep EXACTLY the real service/repository/EM receivers and
 * inject guarded managers into the native MedusaContext parameter. Acquire a
 * missing internal-service transaction through the real repository, fencing its
 * callback before calling the still-decorated native method with that manager.
 * This also preserves the original private subscriber (reconstructing the
 * service would silently lose it). No singleton fields/prototypes are patched.
 *
 * Every exposed call is checked before entry and after successful awaits;
 * manager/driver/query-builder write calls are therefore checked after native
 * repository reads, including update's relation-initialization await. Native
 * implicit transactional flush/commit is fenced with event hooks ONLY on an
 * acquired transaction with an independently owned event manager. Never attach
 * those hooks to a caller's shared manager. Caller-owned transactions must keep
 * their eventual flush/commit inside a fenced scope too.
 *
 * Plain mocks support entry/exit/context/callback fencing, but opaque code that
 * ignores the injected context cannot have its internal side effects fenced.
 * An already dispatched write cannot be recalled; failure is not retry authority.
 */
export function commerceNativeFence<T extends object>(service: T, check: () => void): T {
  const proxies = new WeakMap<object, any>()
  const localEventManagers = new WeakSet<object>()

  function completed(value: any, map: (value: any) => any = value => value): any {
    if (value && typeof value.then === 'function') {
      return Promise.resolve(value).then(result => { check(); return map(result) })
    }
    check()
    return map(value)
  }

  function context(value: any): NativeObject {
    const copy = { ...(value ?? {}) }
    if (copy.manager) copy.manager = wrap(copy.manager)
    if (copy.transactionManager) copy.transactionManager = wrap(copy.transactionManager)
    return copy
  }

  // MikroORM transactional() calls fork.flush() on its REAL private receiver
  // after the callback. A proxy alone cannot guard that implicit flush. Its
  // cloneEventManager fork can own a persistent, invocation-local subscriber.
  function localFlushFence(manager: any, repository: NativeObject): void {
    const root = repository.manager_
    if (!root || manager === root || !manager?.getEventManager || !root.getEventManager) return
    const events: any = Reflect.apply(manager.getEventManager, manager, [])
    const rootEvents: any = Reflect.apply(root.getEventManager, root, [])
    if (!events || events === rootEvents || localEventManagers.has(events)) return
    const guard = () => { check() }
    Reflect.apply(events.registerSubscriber, events, [{
      beforeFlush: guard, beforeCreate: guard, beforeUpdate: guard,
      beforeDelete: guard, beforeUpsert: guard, beforeTransactionCommit: guard,
    }])
    localEventManagers.add(events)
  }

  function transaction(repository: NativeObject, task: (manager: any) => any, options: any): any {
    check()
    const guardedTask = (manager: any) => {
      check() // acquisition can resolve after the capability was revoked
      // Only newly acquired, non-nested transactions may own flush hooks.
      if (!options?.transaction && !options?.ctx) localFlushFence(manager, repository)
      return completed(task(wrap(manager)))
    }
    return completed(Reflect.apply(repository.transaction, repository, [guardedTask, {
      ...options,
      ...(options?.manager ? { manager: wrap(options.manager) } : {}),
      ...(options?.transaction ? { transaction: wrap(options.transaction) } : {}),
    }]))
  }

  function wrap(target: any): any {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target
    const cached = proxies.get(target)
    if (cached) return cached
    const methods = new Map<PropertyKey, NativeCallable>()
    const proxy = new Proxy(target, {
      get(real: NativeObject, key: PropertyKey) {
        const method = Reflect.get(real, key, real)
        if (key === 'constructor' || typeof method !== 'function') return method
        // Respect proxy invariants for immutable own methods, rather than invent
        // a receiver. Such opaque methods are outside this adapter's contract.
        const own = Reflect.getOwnPropertyDescriptor(real, key)
        if (own && !own.configurable && 'value' in own && !own.writable) {
          throw new Error(`Native fence cannot wrap immutable method ${String(key)}`)
        }
        if (!methods.has(key)) methods.set(key, function (...input: any[]) {
          const name = String(key)
          if (cleanup.has(name)) return Reflect.apply(method, real, input)
          check()
          const args = [...input]
          const nativeIndex = real.MedusaContextIndex_?.[key]
          // Read decorators also need an injected manager: they otherwise get
          // an unguarded fresh EM through the real repository's bound receiver.
          const repositoryKey = nativeIndex !== undefined && Reflect.ownKeys(real)
            .find(prop => typeof prop === 'string' && /^__.+Repository__$/.test(prop))
          const index = nativeIndex ?? repositoryContext[name]
          if (index !== undefined) {
            args[index] = context(args[index])
            const repository = repositoryKey ? real[repositoryKey] : real.manager_ ? real : undefined
            if (repository && !args[index].manager && !args[index].transactionManager && !writes.has(name)) {
              const manager = Reflect.apply(repository.getFreshManager, repository, [])
              check()
              localFlushFence(manager, repository)
              args[index].manager = wrap(manager)
            }
            // Direct repository writes cannot use its private fresh-manager fallback.
            if (!repositoryKey && real.manager_ && !args[index].manager && !args[index].transactionManager) {
              args[index].manager = wrap(Reflect.apply(real.getFreshManager, real, []))
              check()
            }
          }
          if (repositoryKey && writes.has(name) && !args[index].transactionManager) {
            const repository = real[repositoryKey]
            const originalContext = args[index]
            return transaction(repository, manager => {
              args[index] = { ...originalContext, transactionManager: manager }
              return Reflect.apply(method, real, args)
            }, {
              manager: originalContext.manager,
              isolationLevel: originalContext.isolationLevel,
              enableNestedTransactions: originalContext.enableNestedTransactions ?? false,
            })
          }
          if (name === 'transaction') return transaction(real, args[0], args[1])
          if (name === 'transactional') {
            const callback = args[0]
            args[0] = (manager: any) => { check(); return completed(callback(wrap(manager))) }
          }
          // Knex's then callback executes SQL; fence both continuation and
          // execution, while retaining its genuine builder receiver.
          if (name === 'then') {
            for (let i = 0; i < args.length; i++) if (typeof args[i] === 'function') {
              const callback = args[i]
              args[i] = (...values: any[]) => { check(); return callback(...values) }
            }
          }
          const result: any = Reflect.apply(method, real, args)
          // Fluent builder methods return the same real builder, not a new
          // Promise to assimilate prematurely. Preserve chaining and identity.
          if (result === real) { check(); return proxy }
          if (resources.has(name) || ['getDriver', 'getConnection'].includes(name)) {
            if (result instanceof Promise) return completed(result, wrap)
            check()
            return wrap(result)
          }
          // Query-builder chains can return distinct builders too.
          if (result && typeof result === 'object' && typeof result.execute === 'function' &&
              typeof result.then === 'function' && !(result instanceof Promise)) {
            check(); return wrap(result)
          }
          return completed(result)
        })
        return methods.get(key)
      },
      apply(real, thisArg, args) {
        check()
        const result = Reflect.apply(real as unknown as NativeCallable, thisArg, args)
        check()
        return wrap(result)
      },
    })
    proxies.set(target, proxy)
    // Do not double-wrap an injected manager on native nested list calls.
    proxies.set(proxy, proxy)
    return proxy
  }

  return wrap(service)
}
