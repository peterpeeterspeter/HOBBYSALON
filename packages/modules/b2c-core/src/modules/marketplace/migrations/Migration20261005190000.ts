import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Loaded by the EXISTING marketplace module's MikroORM migration lifecycle.
 * Raw immutable outbox is intentionally not a soft-deletable Medusa model.
 * Shared PostgreSQL/public schema with native order is required. Duplicate
 * historical capture transactions abort this migration; never delete money rows.
 */
export class Migration20261005190000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE TABLE marketplace_capture_tail (
      payment_id text PRIMARY KEY CHECK (length(payment_id) BETWEEN 1 AND 255),
      cart_id text NOT NULL UNIQUE CHECK (length(cart_id) BETWEEN 1 AND 255),
      capture_id text UNIQUE CHECK (length(capture_id) BETWEEN 1 AND 255),
      snapshot jsonb NOT NULL CHECK ((jsonb_typeof(snapshot) = 'object' AND snapshot->>'version' = '1'
        AND snapshot->>'payment_id' = payment_id AND snapshot->>'cart_id' = cart_id
        AND jsonb_typeof(snapshot->'allocations') = 'array') IS TRUE),
      event_id text NOT NULL UNIQUE CHECK (event_id ~ '^marketplace-captured-[a-f0-9]{64}$'),
      accounting_at timestamptz,
      event_enqueued_at timestamptz,
      completed_at timestamptz,
      last_attempt_at timestamptz,
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (accounting_at IS NULL OR capture_id IS NOT NULL),
      CHECK (event_enqueued_at IS NULL OR accounting_at IS NOT NULL),
      CHECK (completed_at IS NULL OR event_enqueued_at IS NOT NULL)
    );
    CREATE INDEX marketplace_capture_tail_pending ON marketplace_capture_tail
      (last_attempt_at NULLS FIRST, created_at) WHERE completed_at IS NULL;
    CREATE UNIQUE INDEX marketplace_order_capture_once ON order_transaction (order_id, reference_id)
      WHERE reference = 'capture' AND reference_id IS NOT NULL;
    -- This release supports exactly one FULL capture per payment. The native
    -- reservation transaction cannot race a second operation identity, even
    -- when an old lock session dies while its separate ORM write is in flight.
    -- Include deleted rows: financial identities must never be silently reused.
    CREATE UNIQUE INDEX marketplace_payment_full_capture_once ON capture (payment_id);
    CREATE FUNCTION marketplace_capture_tail_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'marketplace capture operation cannot be deleted'; END IF;
      IF NEW.payment_id IS DISTINCT FROM OLD.payment_id OR NEW.cart_id IS DISTINCT FROM OLD.cart_id
        OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.event_id IS DISTINCT FROM OLD.event_id
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR (OLD.capture_id IS NOT NULL AND NEW.capture_id IS DISTINCT FROM OLD.capture_id)
        OR (OLD.accounting_at IS NOT NULL AND NEW.accounting_at IS DISTINCT FROM OLD.accounting_at)
        OR (OLD.event_enqueued_at IS NOT NULL AND NEW.event_enqueued_at IS DISTINCT FROM OLD.event_enqueued_at)
        OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at)
        OR NEW.attempts < OLD.attempts THEN
        RAISE EXCEPTION 'marketplace capture operation is immutable';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER marketplace_capture_tail_immutable BEFORE UPDATE OR DELETE ON marketplace_capture_tail
      FOR EACH ROW EXECUTE FUNCTION marketplace_capture_tail_immutable();`)
  }
  async down(): Promise<void> {
    // Explicit operator rollback only; loses replay/dedup evidence. Not automatic.
    this.addSql(`DROP TABLE marketplace_capture_tail;
      DROP FUNCTION marketplace_capture_tail_immutable();
      DROP INDEX marketplace_order_capture_once;
      DROP INDEX marketplace_payment_full_capture_once;`)
  }
}
