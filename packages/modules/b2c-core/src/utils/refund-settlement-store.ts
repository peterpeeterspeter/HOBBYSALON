import { createHash } from 'node:crypto'
import type { Knex } from 'knex'
import {
  SettlementError,
  type SettlementPhase,
  type SettlementRecord,
  type SettlementSession,
  type SettlementStore,
} from './refund-settlement'

// to_jsonb preserves compatibility with the old schema while detecting a closure
// marker on any phase (including tampered 'completed'). Absence is never authority.
const columns = "operation_id, order_id, scope_id, fingerprint, plan, phase, reversal_receipt_id, to_jsonb(refund_settlement)->>'no_effect_receipt_id' AS no_effect_receipt_id"
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}
function decode(row: any): SettlementRecord | null {
  if (!row) return null
  if (row.phase === 'refund_no_effect') throw new SettlementError('reconciliation_required')
  if (row.no_effect_receipt_id != null) throw new SettlementError('storage_failure')
  return {
    input: { operation_id: row.operation_id, order_id: row.order_id, scope_id: row.scope_id, fingerprint: row.fingerprint },
    plan: typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan,
    phase: row.phase,
    reversal_receipt_id: row.reversal_receipt_id,
  }
}
function sanitized(error: unknown): SettlementError {
  return new SettlementError(error instanceof SettlementError ? error.code : 'storage_failure')
}

/**
 * Pass the ROOT Knex resolved from ContainerRegistrationKeys.PG_CONNECTION, never a transaction,
 * ORM manager, or a request-scoped transaction wrapper. No .transaction(), BEGIN or ambient context
 * is used. Each invocation checks out one physical pg connection, holds a fail-fast SESSION advisory
 * lock, and binds EVERY ledger query to that connection. Statements autocommit independently with
 * synchronous_commit=on before any external money callback. Requires session-affine PostgreSQL
 * connections (NOT PgBouncer transaction/statement pooling) and the refund_settlement migration.
 *
 * Session API is documented by SettlementSession. getOperation is intentionally global so a reused
 * operation ID with a different scope is rejected before planning. Writes are scope-bound; create is
 * INSERT-only and transition is compare-and-swap. Database constraints/triggers guard snapshots and
 * legal forward phases. Scope locks have no timeout/TTL-based recovery. A process disconnect releases
 * the lock, but committed *_started rows remain reconciliation-only.
 *
 * Lock acquisition uncertainty or failed unlock destroys/marks the physical connection disposed
 * BEFORE returning it to Knex's pool; a locked connection must never be loaned to another request.
 * A failed release is also discarded. No original DB message, bindings, or cause escapes this API.
 */
export function createPostgresSettlementStore(knex: Knex, check?: () => void): SettlementStore {
  const client = knex?.client
  if (!client || knex.isTransaction || client.transacting || typeof knex.raw !== 'function' ||
      typeof client.acquireConnection !== 'function' || typeof client.releaseConnection !== 'function' ||
      typeof client.destroyRawConnection !== 'function') throw new SettlementError('invalid_input')

  return {
    async withScopeLock<T>(scopeId: string, work: (session: SettlementSession) => Promise<T>): Promise<T> {
      if (!validId(scopeId) || typeof work !== 'function') throw new SettlementError('invalid_input')
      // Namespaced signed int64. Hash collisions only over-serialize scopes; they never bypass a lock.
      const key = createHash('sha256').update(`hobbysalon:refund-settlement:v1:${scopeId}`).digest().readBigInt64BE(0).toString()
      let connection: any
      check?.()
      try { connection = await client.acquireConnection() }
      catch { throw new SettlementError('lock_unavailable') }

      let locked = false, uncertainLock = false, active = false, discard = false, lost = false
      let failure: SettlementError | undefined
      let value!: T
      const revoke = () => { lost = true; active = false; discard = true }
      connection.on?.('error', revoke)
      connection.on?.('end', revoke)
      const assertConnection = () => {
        if (lost || connection.__knex__disposed || connection._ending || connection._ended) {
          revoke()
          throw new SettlementError('lock_unavailable')
        }
        check?.()
      }
      const assertActive = () => {
        assertConnection()
        if (!active) throw new SettlementError('lock_unavailable')
      }
      const raw = (sql: string, bindings: any[] = []) => knex.raw(sql, bindings).connection(connection)
      const query = async (sql: string, bindings: any[] = []) => {
        assertActive()
        let response: any
        try { response = await raw(sql, bindings) }
        catch { revoke(); throw new SettlementError('storage_failure') }
        assertActive()
        return response
      }
      const session: SettlementSession = {
        assertActive,
        async getOperation(operationId) {
          if (!validId(operationId)) throw new SettlementError('invalid_input')
          try {
            const response = await query(`SELECT ${columns} FROM refund_settlement WHERE operation_id = ? LIMIT 1`, [operationId])
            return decode(response.rows[0])
          } catch (error) { throw sanitized(error) }
        },
        async findUnfinished(exceptOperationId) {
          if (!validId(exceptOperationId)) throw new SettlementError('invalid_input')
          try {
            const response = await query(`SELECT ${columns} FROM refund_settlement WHERE scope_id = ? AND operation_id <> ?
              AND (phase <> 'completed' OR to_jsonb(refund_settlement)->>'no_effect_receipt_id' IS NOT NULL) LIMIT 1`, [scopeId, exceptOperationId])
            return decode(response.rows[0])
          } catch (error) { throw sanitized(error) }
        },
        async create(record) {
          if (record.input.scope_id !== scopeId || !validId(record.input.operation_id) || record.phase !== 'pending' || record.reversal_receipt_id !== null) {
            throw new SettlementError('invalid_input')
          }
          try {
            const response = await query(`INSERT INTO refund_settlement (operation_id, order_id, scope_id, fingerprint, plan, phase, reversal_receipt_id)
              VALUES (?, ?, ?, ?, ?::jsonb, 'pending', NULL) RETURNING operation_id`, [
              record.input.operation_id, record.input.order_id, scopeId, record.input.fingerprint, JSON.stringify(record.plan),
            ])
            if (response.rowCount !== 1) throw new SettlementError('storage_failure')
          } catch (error) { throw sanitized(error) }
        },
        async transition(operationId: string, expected: SettlementPhase, next: SettlementPhase, reversalReceiptId: string | null = null) {
          if (!validId(operationId) || (reversalReceiptId !== null && !validId(reversalReceiptId))) throw new SettlementError('invalid_input')
          // Ordinary CAS is NOT a close API, even when old/disabled DB guards
          // would accept arbitrary UPDATE. No terminal reset or no-effect writes.
          const forward: Record<string, readonly string[]> = {
            pending: ['refund_started', 'refund_completed'], refund_started: ['refund_completed'],
            refund_completed: ['reversal_started', 'completed'], reversal_started: ['completed'],
          }
          if (!forward[expected]?.includes(next)) throw new SettlementError('invalid_input')
          const response = await query(`UPDATE refund_settlement SET phase = ?, reversal_receipt_id = ?, updated_at = now()
            WHERE operation_id = ? AND scope_id = ? AND phase = ? RETURNING operation_id`, [next, reversalReceiptId, operationId, scopeId, expected])
          if (response.rowCount !== 1) throw new SettlementError('storage_failure')
        },
      }
      try {
        assertConnection() // loss during checkout must prevent lock SQL/work
        try {
          uncertainLock = true
          const response = await raw('SELECT pg_try_advisory_lock(?::bigint) AS locked', [key])
          // A missing/malformed response may conceal successful acquisition: discard, do not release.
          if (response?.rows?.[0]?.locked === false) uncertainLock = false
          if (response?.rows?.[0]?.locked !== true) throw new Error()
          locked = true
          uncertainLock = false
          assertConnection()
        } catch { throw new SettlementError('lock_unavailable') }
        assertConnection()
        await raw('SET SESSION synchronous_commit = on')
        assertConnection() // acquisition loss is irreversible, even if SQL resolves
        active = true
        assertActive()
        value = await work(session)
        assertActive()
      } catch (error) { failure = sanitized(error) }
      finally {
        active = false
        discard ||= uncertainLock
        if (locked && !lost) {
          try {
            const response = await raw('SELECT pg_advisory_unlock(?::bigint) AS unlocked', [key])
            if (response?.rows?.[0]?.unlocked !== true) throw new Error()
          } catch { discard = true; failure ??= new SettlementError('storage_failure') }
        }
        if (!discard) {
          try { await client.releaseConnection(connection) }
          catch { discard = true; failure ??= new SettlementError('storage_failure') }
        }
        if (discard) {
          // Knex checks __knex__disposed on pool validation. Do not call pool.destroy(connection):
          // Tarn's destroy() shuts down the WHOLE pool, not a single checked-out resource.
          connection.__knex__disposed = true
          try { await client.destroyRawConnection(connection) }
          catch { failure ??= new SettlementError('storage_failure') }
          try { await client.releaseConnection(connection) }
          catch { failure ??= new SettlementError('storage_failure') }
        }
        connection.removeListener?.('error', revoke)
        connection.removeListener?.('end', revoke)
      }
      if (failure) throw failure
      return value
    },
  }
}
