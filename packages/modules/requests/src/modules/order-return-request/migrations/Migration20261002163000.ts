import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Permanent evidence: intentionally irreversible, independent of request soft deletion. */
export class Migration20261002163000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE native_return_execution (
      request_id text PRIMARY KEY CHECK (length(request_id) BETWEEN 1 AND 255 AND request_id = btrim(request_id) AND request_id !~ '[[:cntrl:]]'),
      order_id text NOT NULL CHECK (length(order_id) BETWEEN 1 AND 255 AND order_id = btrim(order_id) AND order_id !~ '[[:cntrl:]]'),
      fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
      plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object' AND plan->>'request_id' IS NOT NULL AND plan->>'order_id' IS NOT NULL AND plan->>'request_id' = request_id AND plan->>'order_id' = order_id),
      native_return_id text UNIQUE CHECK (length(native_return_id) BETWEEN 1 AND 255 AND native_return_id = btrim(native_return_id) AND native_return_id !~ '[[:cntrl:]]'),
      order_change_id text UNIQUE CHECK (length(order_change_id) BETWEEN 1 AND 255 AND order_change_id = btrim(order_change_id) AND order_change_id !~ '[[:cntrl:]]'),
      phase text NOT NULL CHECK (phase IN ('pending','begin_started','begun','items_started','items_done','confirm_started','confirmed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((phase IN ('pending','begin_started') AND native_return_id IS NULL AND order_change_id IS NULL)
        OR (phase IN ('begun','items_started','items_done','confirm_started','confirmed') AND native_return_id IS NOT NULL AND order_change_id IS NOT NULL))
    );`)
    this.addSql(`CREATE UNIQUE INDEX native_return_execution_unfinished_order ON native_return_execution (order_id) WHERE phase <> 'confirmed';`)
    this.addSql(`CREATE FUNCTION guard_native_return_execution() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'native return evidence is permanent';
      END IF;
      IF TG_OP = 'INSERT' THEN
        IF NEW.phase <> 'pending' OR NEW.native_return_id IS NOT NULL OR NEW.order_change_id IS NOT NULL THEN
          RAISE EXCEPTION 'native return must start pending';
        END IF;
        RETURN NEW;
      END IF;
      IF NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.order_id IS DISTINCT FROM OLD.order_id
        OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint OR NEW.plan IS DISTINCT FROM OLD.plan
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'native return plan is immutable';
      END IF;
      IF (OLD.native_return_id IS NOT NULL AND NEW.native_return_id IS DISTINCT FROM OLD.native_return_id)
        OR (OLD.order_change_id IS NOT NULL AND NEW.order_change_id IS DISTINCT FROM OLD.order_change_id) THEN
        RAISE EXCEPTION 'native return identity is immutable';
      END IF;
      IF NOT ((OLD.phase = 'pending' AND NEW.phase = 'begin_started')
        OR (OLD.phase = 'begin_started' AND NEW.phase = 'begun')
        OR (OLD.phase = 'begun' AND NEW.phase = 'items_started')
        OR (OLD.phase = 'items_started' AND NEW.phase = 'items_done')
        OR (OLD.phase = 'items_done' AND NEW.phase = 'confirm_started')
        OR (OLD.phase = 'confirm_started' AND NEW.phase = 'confirmed')) THEN
        RAISE EXCEPTION 'illegal native return phase transition';
      END IF;
      RETURN NEW;
    END $$;`)
    this.addSql(`CREATE TRIGGER native_return_execution_guard BEFORE INSERT OR UPDATE OR DELETE ON native_return_execution FOR EACH ROW EXECUTE FUNCTION guard_native_return_execution();`)
    this.addSql(`CREATE TRIGGER native_return_execution_no_truncate BEFORE TRUNCATE ON native_return_execution FOR EACH STATEMENT EXECUTE FUNCTION guard_native_return_execution();`)
  }

  override async down(): Promise<void> {
    throw new Error('native_return_execution is permanent; rollback requires explicit reconciliation')
  }
}
