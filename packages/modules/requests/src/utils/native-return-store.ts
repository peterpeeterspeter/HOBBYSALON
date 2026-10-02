import { createHash } from 'node:crypto'
import type { Knex } from 'knex'
import {
  NativeReturnError,
  validNativeReturnId,
  fingerprintNativeReturnPlan,
  type NativeReturnRecord,
  type NativeReturnSession,
  type NativeReturnStore,
} from './native-return-lifecycle'

const columns = 'request_id, order_id, fingerprint, plan, native_return_id, order_change_id, phase'
function decode(row: any): NativeReturnRecord | null {
  if (!row) return null
  const plan = typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan
  if (plan?.request_id !== row.request_id || plan?.order_id !== row.order_id ||
      (row.native_return_id === null) !== (row.order_change_id === null)) throw new NativeReturnError('reconciliation_required')
  return { plan, fingerprint: row.fingerprint, phase: row.phase,
    identity: row.native_return_id === null ? null : { return_id: row.native_return_id, order_change_id: row.order_change_id } }
}
const sanitized = (error: unknown) => new NativeReturnError(error instanceof NativeReturnError ? error.code : 'storage_failure')

/**
 * ROOT PG_CONNECTION Knex only, never an ORM/ambient transaction. One dedicated physical connection
 * holds a fail-fast SESSION advisory lock across ALL native phases. Every bound statement autocommits
 * with synchronous_commit=on BEFORE effects. Requires session-affine PostgreSQL (no transaction-pooling).
 * An uncertain acquisition/unlock/release discards the connection, never loans a potentially held lock.
 * No TTL, deletes, automatic reconciliation, or transaction compensation is provided.
 */
export function createPostgresNativeReturnStore(rootKnex: Knex): NativeReturnStore {
  const client = rootKnex?.client
  if (!client || rootKnex.isTransaction || client.transacting || typeof rootKnex.raw !== 'function' ||
      typeof client.acquireConnection !== 'function' || typeof client.releaseConnection !== 'function' ||
      typeof client.destroyRawConnection !== 'function') throw new NativeReturnError('invalid_input')
  return {
    async withOrderLock<T>(orderId: string, work: (session: NativeReturnSession) => Promise<T>): Promise<T> {
      if (!validNativeReturnId(orderId) || typeof work !== 'function') throw new NativeReturnError('invalid_input')
      const key = createHash('sha256').update(`hobbysalon:native-return:v1:${orderId}`).digest().readBigInt64BE(0).toString()
      let connection: any
      try { connection = await client.acquireConnection() } catch { throw new NativeReturnError('lock_unavailable') }
      let locked = false, uncertain = false, active = false, discard = false
      let failure: NativeReturnError | undefined, result!: T
      const raw = (sql: string, bindings: any[] = []) => rootKnex.raw(sql, bindings).connection(connection)
      const query = async (sql: string, bindings: any[] = []) => {
        if (!active) throw new NativeReturnError('lock_unavailable')
        try { return await raw(sql, bindings) } catch { throw new NativeReturnError('storage_failure') }
      }
      const session: NativeReturnSession = {
        async getRequest(id) {
          if (!validNativeReturnId(id)) throw new NativeReturnError('invalid_input')
          try { return decode((await query(`SELECT ${columns} FROM native_return_execution WHERE request_id = ? LIMIT 1`, [id])).rows[0]) }
          catch (error) { throw sanitized(error) }
        },
        async findUnfinished(except) {
          if (!validNativeReturnId(except)) throw new NativeReturnError('invalid_input')
          try { return decode((await query(`SELECT ${columns} FROM native_return_execution WHERE order_id = ? AND request_id <> ? AND phase <> 'confirmed' LIMIT 1`, [orderId, except])).rows[0]) }
          catch (error) { throw sanitized(error) }
        },
        async create(record) {
          if (record.plan.order_id !== orderId || record.phase !== 'pending' || record.identity !== null || fingerprintNativeReturnPlan(record.plan) !== record.fingerprint) throw new NativeReturnError('invalid_input')
          const r = await query(`INSERT INTO native_return_execution (request_id, order_id, fingerprint, plan, phase)
            VALUES (?, ?, ?, ?::jsonb, 'pending') RETURNING request_id`, [record.plan.request_id, orderId, record.fingerprint, JSON.stringify(record.plan)])
          if (r.rowCount !== 1) throw new NativeReturnError('storage_failure')
        },
        async transition(id, expected, next, identity = null) {
          if (!validNativeReturnId(id) || (identity !== null && (!validNativeReturnId(identity.return_id) || !validNativeReturnId(identity.order_change_id)))) throw new NativeReturnError('invalid_input')
          const r = await query(`UPDATE native_return_execution SET phase = ?, native_return_id = COALESCE(?::text, native_return_id),
            order_change_id = COALESCE(?::text, order_change_id), updated_at = now()
            WHERE request_id = ? AND order_id = ? AND phase = ? RETURNING request_id`, [next, identity?.return_id ?? null, identity?.order_change_id ?? null, id, orderId, expected])
          if (r.rowCount !== 1) throw new NativeReturnError('storage_failure')
        },
      }
      try {
        try {
          uncertain = true
          const r = await raw('SELECT pg_try_advisory_lock(?::bigint) AS locked', [key])
          if (r?.rows?.[0]?.locked === false) uncertain = false
          if (r?.rows?.[0]?.locked !== true) throw new Error()
          locked = true; uncertain = false
        } catch { throw new NativeReturnError('lock_unavailable') }
        await raw('SET SESSION synchronous_commit = on')
        active = true; result = await work(session)
      } catch (error) { failure = sanitized(error) }
      finally {
        active = false; discard = uncertain
        if (locked) {
          try { if ((await raw('SELECT pg_advisory_unlock(?::bigint) AS unlocked', [key]))?.rows?.[0]?.unlocked !== true) throw new Error() }
          catch { discard = true; failure ??= new NativeReturnError('storage_failure') }
        }
        if (!discard) {
          try { await client.releaseConnection(connection) }
          catch { discard = true; failure ??= new NativeReturnError('storage_failure') }
        }
        if (discard) {
          connection.__knex__disposed = true
          try { await client.destroyRawConnection(connection) } catch { failure ??= new NativeReturnError('storage_failure') }
          try { await client.releaseConnection(connection) } catch { failure ??= new NativeReturnError('storage_failure') }
        }
      }
      if (failure) throw failure
      return result
    },
  }
}
